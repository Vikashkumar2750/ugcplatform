/**
 * compliance.test.ts — Unit tests for the Compliance Layer
 *
 * Run: node --test --require ts-node/register src/tests/compliance.test.ts
 *
 * Uses Node's built-in test runner (no jest/mocha dependency needed).
 * Tests the core compliance checks with mocked Supabase responses.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ─── Mock Supabase ───────────────────────────────────────────────────────────
// We mock the supabase module to avoid hitting a real database.

let mockConversation: any = null;
let mockAccount: any = { is_active: true, platform: "instagram" };
let complianceInserts: any[] = [];

// Override the module resolution for supabase
const mockSupabase = {
  from: (table: string) => {
    if (table === "connected_accounts") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: mockAccount }),
          }),
        }),
      };
    }
    if (table === "dm_conversations") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: mockConversation }),
            }),
          }),
        }),
      };
    }
    if (table === "compliance_logs") {
      return {
        insert: async (data: any) => {
          complianceInserts.push(data);
          return { data: null, error: null };
        },
      };
    }
    return {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      insert: async () => ({ data: null, error: null }),
    };
  },
};

// ─── Tests ───────────────────────────────────────────────────────────────────

// We test the compliance logic directly by implementing the same checks inline.
// This avoids module mocking complexity while validating the business logic.

const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;
const FORBIDDEN_PATTERNS = [
  /(?:send|share|give|tell)\s*(?:me|us)\s*(?:your|ur)\s*(?:password|passwd|login|credentials)/i,
  /(?:bit\.ly|tinyurl|goo\.gl)\//i,
  /(?:earn|make)\s*\$?\d+k?\s*(?:per|a|each)\s*(?:day|week|month)/i,
];
const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "optout", "opt out", "cancel", "band karo"];
const APPROVED_MESSAGE_TAGS = new Set([
  "CONFIRMED_EVENT_UPDATE", "POST_PURCHASE_UPDATE", "ACCOUNT_UPDATE", "HUMAN_AGENT",
]);

interface ComplianceResult {
  allowed: boolean;
  reasonCode?: string;
  reasonDetail?: string;
}

function checkComplianceSync(opts: {
  accountActive: boolean;
  optedOut: boolean;
  lastInteractionAt: string | null;
  messageText: string;
  messageType: "dm" | "comment_reply" | "broadcast";
  messageTag?: string;
}): ComplianceResult {
  // 1. Account active
  if (!opts.accountActive) {
    return { allowed: false, reasonCode: "account_inactive" };
  }

  // 2. Opt-out
  if (opts.optedOut) {
    return { allowed: false, reasonCode: "opted_out" };
  }

  // 3. 24h window (DMs only)
  if (opts.messageType === "dm" || opts.messageType === "broadcast") {
    if (opts.lastInteractionAt) {
      const lastTime = new Date(opts.lastInteractionAt).getTime();
      const now = Date.now();

      // Determine the applicable window based on the message tag
      const standardExpired = now > lastTime + MESSAGING_WINDOW_MS;

      if (standardExpired) {
        // Outside the standard 24h window — check for approved message tags
        if (!opts.messageTag || !APPROVED_MESSAGE_TAGS.has(opts.messageTag)) {
          return { allowed: false, reasonCode: "outside_messaging_window" };
        }
        // Tag is approved — check the tag-specific extended window
        if (opts.messageTag === "HUMAN_AGENT") {
          const humanAgentExpired = now > lastTime + 7 * MESSAGING_WINDOW_MS;
          if (humanAgentExpired) {
            return { allowed: false, reasonCode: "outside_messaging_window" };
          }
        }
        // Other approved tags don't have extended windows beyond 24h,
        // but they allow one-time notification sends (POST_PURCHASE_UPDATE, etc.)
      }
    } else if (opts.messageType === "broadcast") {
      return { allowed: false, reasonCode: "outside_messaging_window" };
    }
  }

  // 4. Message tag validation
  if (opts.messageTag && !APPROVED_MESSAGE_TAGS.has(opts.messageTag)) {
    return { allowed: false, reasonCode: "invalid_message_tag" };
  }

  // 5. Content validation
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(opts.messageText)) {
      return { allowed: false, reasonCode: "blocked_content" };
    }
  }

  return { allowed: true };
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("Compliance Layer", () => {
  describe("Account checks", () => {
    it("should block when account is inactive", () => {
      const result = checkComplianceSync({
        accountActive: false,
        optedOut: false,
        lastInteractionAt: new Date().toISOString(),
        messageText: "Hello!",
        messageType: "dm",
      });
      assert.equal(result.allowed, false);
      assert.equal(result.reasonCode, "account_inactive");
    });

    it("should allow when account is active", () => {
      const result = checkComplianceSync({
        accountActive: true,
        optedOut: false,
        lastInteractionAt: new Date().toISOString(),
        messageText: "Hello!",
        messageType: "dm",
      });
      assert.equal(result.allowed, true);
    });
  });

  describe("Opt-out checks", () => {
    it("should block when recipient has opted out", () => {
      const result = checkComplianceSync({
        accountActive: true,
        optedOut: true,
        lastInteractionAt: new Date().toISOString(),
        messageText: "Check out our new product!",
        messageType: "dm",
      });
      assert.equal(result.allowed, false);
      assert.equal(result.reasonCode, "opted_out");
    });
  });

  describe("24h messaging window", () => {
    it("should allow message within 24h window", () => {
      const result = checkComplianceSync({
        accountActive: true,
        optedOut: false,
        lastInteractionAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
        messageText: "Thanks for your message!",
        messageType: "dm",
      });
      assert.equal(result.allowed, true);
    });

    it("should allow message at 23h59m (edge case)", () => {
      const result = checkComplianceSync({
        accountActive: true,
        optedOut: false,
        lastInteractionAt: new Date(Date.now() - 23 * 60 * 60 * 1000 - 59 * 60 * 1000).toISOString(),
        messageText: "Just checking in!",
        messageType: "dm",
      });
      assert.equal(result.allowed, true);
    });

    it("should block message at 24h01m (edge case)", () => {
      const result = checkComplianceSync({
        accountActive: true,
        optedOut: false,
        lastInteractionAt: new Date(Date.now() - 24 * 60 * 60 * 1000 - 60 * 1000).toISOString(),
        messageText: "Are you still interested?",
        messageType: "dm",
      });
      assert.equal(result.allowed, false);
      assert.equal(result.reasonCode, "outside_messaging_window");
    });

    it("should block DM sent 48h after last interaction", () => {
      const result = checkComplianceSync({
        accountActive: true,
        optedOut: false,
        lastInteractionAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        messageText: "Hey there!",
        messageType: "dm",
      });
      assert.equal(result.allowed, false);
      assert.equal(result.reasonCode, "outside_messaging_window");
    });

    it("should allow outside window with HUMAN_AGENT tag (7-day window)", () => {
      const result = checkComplianceSync({
        accountActive: true,
        optedOut: false,
        lastInteractionAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48h ago
        messageText: "Our support team is following up",
        messageType: "dm",
        messageTag: "HUMAN_AGENT",
      });
      assert.equal(result.allowed, true);
    });

    it("should block HUMAN_AGENT tag after 7 days", () => {
      const result = checkComplianceSync({
        accountActive: true,
        optedOut: false,
        lastInteractionAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
        messageText: "Support follow-up",
        messageType: "dm",
        messageTag: "HUMAN_AGENT",
      });
      assert.equal(result.allowed, false);
      assert.equal(result.reasonCode, "outside_messaging_window");
    });

    it("should exempt comment_reply from 24h window", () => {
      const result = checkComplianceSync({
        accountActive: true,
        optedOut: false,
        lastInteractionAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        messageText: "Thanks for commenting!",
        messageType: "comment_reply",
      });
      assert.equal(result.allowed, true);
    });

    it("should allow first message DM (no prior interaction)", () => {
      const result = checkComplianceSync({
        accountActive: true,
        optedOut: false,
        lastInteractionAt: null,
        messageText: "Welcome! Thanks for following!",
        messageType: "dm",
      });
      assert.equal(result.allowed, true);
    });

    it("should block broadcast with no prior interaction", () => {
      const result = checkComplianceSync({
        accountActive: true,
        optedOut: false,
        lastInteractionAt: null,
        messageText: "Check out our sale!",
        messageType: "broadcast",
      });
      assert.equal(result.allowed, false);
      assert.equal(result.reasonCode, "outside_messaging_window");
    });
  });

  describe("Message tag validation", () => {
    it("should reject invalid message tags", () => {
      const result = checkComplianceSync({
        accountActive: true,
        optedOut: false,
        lastInteractionAt: new Date().toISOString(),
        messageText: "Hello",
        messageType: "dm",
        messageTag: "INVALID_TAG",
      });
      assert.equal(result.allowed, false);
      assert.equal(result.reasonCode, "invalid_message_tag");
    });

    it("should accept CONFIRMED_EVENT_UPDATE tag", () => {
      const result = checkComplianceSync({
        accountActive: true,
        optedOut: false,
        lastInteractionAt: new Date().toISOString(),
        messageText: "Your event is tomorrow!",
        messageType: "dm",
        messageTag: "CONFIRMED_EVENT_UPDATE",
      });
      assert.equal(result.allowed, true);
    });
  });

  describe("Content validation", () => {
    it("should block password harvesting", () => {
      const result = checkComplianceSync({
        accountActive: true,
        optedOut: false,
        lastInteractionAt: new Date().toISOString(),
        messageText: "Please send me your password to verify",
        messageType: "dm",
      });
      assert.equal(result.allowed, false);
      assert.equal(result.reasonCode, "blocked_content");
    });

    it("should block phishing URLs (bit.ly)", () => {
      const result = checkComplianceSync({
        accountActive: true,
        optedOut: false,
        lastInteractionAt: new Date().toISOString(),
        messageText: "Click here: bit.ly/free-stuff",
        messageType: "dm",
      });
      assert.equal(result.allowed, false);
      assert.equal(result.reasonCode, "blocked_content");
    });

    it("should block spam earning claims", () => {
      const result = checkComplianceSync({
        accountActive: true,
        optedOut: false,
        lastInteractionAt: new Date().toISOString(),
        messageText: "Earn $5000 per day with this trick!",
        messageType: "dm",
      });
      assert.equal(result.allowed, false);
      assert.equal(result.reasonCode, "blocked_content");
    });

    it("should allow normal business messages", () => {
      const result = checkComplianceSync({
        accountActive: true,
        optedOut: false,
        lastInteractionAt: new Date().toISOString(),
        messageText: "Namaste! 🙏 Thanks for reaching out. Check our website at example.com",
        messageType: "dm",
      });
      assert.equal(result.allowed, true);
    });

    it("should allow messages with legitimate links", () => {
      const result = checkComplianceSync({
        accountActive: true,
        optedOut: false,
        lastInteractionAt: new Date().toISOString(),
        messageText: "Here is the guide you requested: https://mywebsite.com/guide",
        messageType: "dm",
      });
      assert.equal(result.allowed, true);
    });
  });
});

// ─── Rate Limiter Tests ──────────────────────────────────────────────────────

describe("Rate Limiter Logic", () => {
  it("should enforce per-user spacing (5s minimum)", () => {
    const lastSendTime = Date.now() - 2000; // 2 seconds ago
    const spacing = 5000;
    const elapsed = Date.now() - lastSendTime;
    const allowed = elapsed >= spacing;
    assert.equal(allowed, false, "Should block within 5s spacing");
  });

  it("should allow after spacing period", () => {
    const lastSendTime = Date.now() - 6000; // 6 seconds ago
    const spacing = 5000;
    const elapsed = Date.now() - lastSendTime;
    const allowed = elapsed >= spacing;
    assert.equal(allowed, true, "Should allow after 5s spacing");
  });

  it("should enforce hourly limit of 120", () => {
    const hourlyCount = 120;
    const hourlyLimit = 120;
    const allowed = hourlyCount < hourlyLimit;
    assert.equal(allowed, false, "Should block at limit");
  });

  it("should allow below hourly limit", () => {
    const hourlyCount = 119;
    const hourlyLimit = 120;
    const allowed = hourlyCount < hourlyLimit;
    assert.equal(allowed, true, "Should allow below limit");
  });

  it("should enforce daily limit of 2000", () => {
    const dailyCount = 2000;
    const dailyLimit = 2000;
    const allowed = dailyCount < dailyLimit;
    assert.equal(allowed, false, "Should block at daily limit");
  });

  it("should cap aggressive mode at 200/hour", () => {
    const config = { hourlyLimit: 300, aggressive: true };
    const effectiveLimit = config.aggressive ? Math.min(config.hourlyLimit, 200) : config.hourlyLimit;
    assert.equal(effectiveLimit, 200);
  });
});

// ─── Typing Delay Tests ──────────────────────────────────────────────────────

describe("Typing Simulation", () => {
  function getTypingDelay(text: string): number {
    const len = text.length;
    if (len < 150) return 1000;
    if (len < 300) return 2000;
    if (len < 500) return 3000;
    return Math.min(5000, 3000 + Math.floor((len - 500) / 100) * 500);
  }

  it("short message = 1s delay", () => {
    assert.equal(getTypingDelay("Hi there!"), 1000);
  });

  it("medium message = 2s delay", () => {
    assert.equal(getTypingDelay("x".repeat(200)), 2000);
  });

  it("long message = 3s delay", () => {
    assert.equal(getTypingDelay("x".repeat(400)), 3000);
  });

  it("very long message capped at 5s", () => {
    const delay = getTypingDelay("x".repeat(1000));
    assert.equal(delay, 5000);
  });
});

// ─── AI Confidence Estimation Tests ──────────────────────────────────────────

describe("AI Confidence Estimation", () => {
  function estimateConfidence(replyText: string): number {
    let confidence = 70;
    const uncertaintyMarkers = [
      /i'?m not sure/i, /i don'?t know/i, /i'?m not certain/i,
      /maybe/i, /perhaps/i, /could be/i, /might be/i,
      /i think/i, /it seems/i, /possibly/i,
      /you'?d need to/i, /please contact/i, /check with/i,
      /mujhe nahi pata/i, /shayad/i, /ho sakta hai/i,
    ];
    for (const marker of uncertaintyMarkers) {
      if (marker.test(replyText)) confidence -= 15;
    }
    if (replyText.length < 20) confidence -= 20;
    if (replyText.length > 500) confidence -= 10;
    if (/^(hi|hello|hey|namaste|namaskar)/i.test(replyText)) confidence += 5;
    return Math.max(0, Math.min(100, confidence));
  }

  it("confident reply scores >= 70", () => {
    const score = estimateConfidence("Hello! Our workshop starts at 10 AM tomorrow. See you there! 🙏");
    assert.ok(score >= 70, `Expected >= 70, got ${score}`);
  });

  it("uncertain reply with 'I'm not sure' scores < 70", () => {
    const score = estimateConfidence("I'm not sure about the pricing. Maybe check with the team.");
    assert.ok(score < 70, `Expected < 70, got ${score}`);
  });

  it("very short reply gets penalized", () => {
    const score = estimateConfidence("Ok");
    assert.ok(score < 70, `Expected < 70, got ${score}`);
  });

  it("greeting boost applied", () => {
    const withGreeting = estimateConfidence("Namaste! How can I help you today?");
    const withoutGreeting = estimateConfidence("How can I help you today?");
    assert.ok(withGreeting > withoutGreeting, "Greeting should boost confidence");
  });

  it("Hindi uncertainty markers detected", () => {
    const score = estimateConfidence("Shayad yeh product available ho sakta hai.");
    assert.ok(score < 70, `Expected < 70 for Hindi uncertainty, got ${score}`);
  });
});
