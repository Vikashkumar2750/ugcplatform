"use client";

import { useState, useEffect } from "react";
import { Globe, Bell, Shield, Save, RefreshCw, Loader2, CheckCircle2 } from "lucide-react";

interface Settings {
  platformName: string;
  contactEmail: string;
  whatsapp: string;
  maintenanceMode: boolean;
  emailNotifications: boolean;
  newUserAlert: boolean;
  failedPaymentAlert: boolean;
  ticketAlert: boolean;
}

const DEFAULTS: Settings = {
  platformName: "ContentIQ",
  contactEmail: "support@techaasvik.in",
  whatsapp: "+91 78270 24726",
  maintenanceMode: false,
  emailNotifications: true,
  newUserAlert: true,
  failedPaymentAlert: true,
  ticketAlert: true,
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(data => {
        if (data.settings && !data.demo) {
          const s = data.settings;
          setSettings({
            platformName: s.platform_name || DEFAULTS.platformName,
            contactEmail: s.contact_email || DEFAULTS.contactEmail,
            whatsapp: s.whatsapp || DEFAULTS.whatsapp,
            maintenanceMode: s.maintenance_mode === "true",
            emailNotifications: s.email_notifications !== "false",
            newUserAlert: s.new_user_alert !== "false",
            failedPaymentAlert: s.failed_payment_alert !== "false",
            ticketAlert: s.ticket_alert !== "false",
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (key: keyof Settings, value: any) =>
    setSettings(s => ({ ...s, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            platform_name: settings.platformName,
            contact_email: settings.contactEmail,
            whatsapp: settings.whatsapp,
            maintenance_mode: String(settings.maintenanceMode),
            email_notifications: String(settings.emailNotifications),
            new_user_alert: String(settings.newUserAlert),
            failed_payment_alert: String(settings.failedPaymentAlert),
            ticket_alert: String(settings.ticketAlert),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-zinc-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-zinc-100">Platform Settings</h1>
          <p className="text-zinc-500 text-sm">Global configuration for ContentIQ platform</p>
        </div>
        {saved && (
          <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" /> Saved to database
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          ❌ {error}
        </div>
      )}

      {/* General */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
        <h2 className="font-semibold text-zinc-100 flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-400" /> General
        </h2>
        {[
          { label: "Platform Name", key: "platformName" as const, type: "text" },
          { label: "Support Email", key: "contactEmail" as const, type: "email" },
          { label: "WhatsApp Contact", key: "whatsapp" as const, type: "tel" },
        ].map(f => (
          <div key={f.key} className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">{f.label}</label>
            <input
              type={f.type}
              value={settings[f.key] as string}
              onChange={e => update(f.key, e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
            />
          </div>
        ))}
        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="text-sm font-medium text-zinc-300">Maintenance Mode</p>
            <p className="text-xs text-zinc-500">Users will see maintenance page</p>
          </div>
          <button
            onClick={() => update("maintenanceMode", !settings.maintenanceMode)}
            className={`w-12 h-6 rounded-full transition-colors ${settings.maintenanceMode ? "bg-red-500" : "bg-zinc-700"}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transition-transform mx-0.5 ${settings.maintenanceMode ? "translate-x-6" : "translate-x-0"}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
        <h2 className="font-semibold text-zinc-100 flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" /> Notifications
        </h2>
        {[
          { label: "Email notifications", key: "emailNotifications" as const },
          { label: "New user signup alert", key: "newUserAlert" as const },
          { label: "Failed payment alert", key: "failedPaymentAlert" as const },
          { label: "New support ticket alert", key: "ticketAlert" as const },
        ].map(n => (
          <div key={n.key} className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">{n.label}</span>
            <button
              onClick={() => update(n.key, !settings[n.key])}
              className={`w-10 h-5 rounded-full transition-colors ${settings[n.key] ? "bg-amber-500" : "bg-zinc-700"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-0.5 ${settings[n.key] ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Admin Credentials Info */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-3">
        <h2 className="font-semibold text-zinc-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-400" /> Admin Credentials
        </h2>
        <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-500 space-y-1">
          <p>Email: <span className="text-zinc-300 font-mono">admin@techaasvik.in</span></p>
          <p>Password: Set via <span className="text-amber-400 font-mono">ADMIN_PASSWORD</span> env variable</p>
          <p className="text-red-400 mt-2">⚠ Change password in Vercel env before production</p>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition disabled:opacity-60 ${
          saved ? "bg-green-500 text-white" : "bg-red-500 text-white hover:bg-red-400"
        }`}
      >
        {saving ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
        ) : saved ? (
          <><CheckCircle2 className="w-4 h-4" /> Saved!</>
        ) : (
          <><Save className="w-4 h-4" /> Save Settings</>
        )}
      </button>
    </div>
  );
}
