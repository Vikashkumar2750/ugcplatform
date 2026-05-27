"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X, CheckCircle2, AlertCircle, Loader2, Zap, Shield, Users } from "lucide-react";

const PLATFORMS = ["Instagram", "YouTube", "Facebook", "Sab (All)"];
const NICHES = ["Fitness", "Finance", "Travel", "Tech", "Food", "Beauty", "Gaming", "Education", "Lifestyle", "Comedy", "Motivation", "Fashion"];
const SOURCES = ["Instagram Ad", "Organic / Search", "Dost ne bataya (Friend)", "Google", "YouTube", "Other"];

interface FormData {
  fullName: string;
  email: string;
  whatsapp: string;
  platform: string;
  niche: string;
  source: string;
}

interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LeadFormModal({ isOpen, onClose }: LeadFormModalProps) {
  const t = useTranslations();
  const [form, setForm] = useState<FormData>({
    fullName: "",
    email: "",
    whatsapp: "",
    platform: "",
    niche: "",
    source: "",
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"form" | "processing" | "success">("form");

  if (!isOpen) return null;

  const validate = () => {
    const errs: Partial<FormData> = {};
    if (!form.fullName.trim()) errs.fullName = t("form.error.required");
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = t("form.error.email");
    if (!form.whatsapp.trim() || !/^\+91[0-9]{10}$/.test(form.whatsapp.replace(/\s/g, "")))
      errs.whatsapp = t("form.error.whatsapp");
    if (!form.platform) errs.platform = t("form.error.required");
    if (!form.niche) errs.niche = t("form.error.required");
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    setStep("processing");

    try {
      // Save lead to DB
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed");

      // Open Razorpay
      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) {
        // Load Razorpay script dynamically
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject();
          document.body.appendChild(script);
        });
      }

      const rzp = new (window as any).Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: 900,
        currency: "INR",
        name: "ContentIQ",
        description: "Lifetime platform access — ek baar pay, hamesha use karo",
        order_id: data.orderId,
        prefill: {
          name: form.fullName,
          email: form.email,
          contact: form.whatsapp,
        },
        theme: { color: "#F59E0B" },
        notes: { lead_id: data.leadId },
        handler: async (response: any) => {
          // Verify payment
          const verifyRes = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              lead_id: data.leadId,
            }),
          });
          if (verifyRes.ok) {
            setStep("success");
            setTimeout(() => {
              window.location.href = "/dashboard?welcome=true";
            }, 2000);
          }
        },
        modal: {
          ondismiss: () => {
            setSubmitting(false);
            setStep("form");
          },
        },
      });
      rzp.open();
    } catch {
      setSubmitting(false);
      setStep("form");
    }
  };

  const update = (field: keyof FormData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-5 flex items-start justify-between rounded-t-2xl">
          <div>
            <h2 className="font-heading text-xl font-bold">{t("form.title")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{t("form.sub")}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition ml-4 mt-0.5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Processing state */}
        {step === "processing" && (
          <div className="p-8 text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-amber-500" />
            <p className="font-heading text-lg font-semibold">Opening secure checkout...</p>
            <p className="text-sm text-muted-foreground mt-1">Razorpay se secure payment</p>
          </div>
        )}

        {/* Success state */}
        {step === "success" && (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <p className="font-heading text-lg font-semibold">{t("payment.success")}</p>
            <p className="text-sm text-muted-foreground mt-1">Dashboard par ja rahe hain...</p>
          </div>
        )}

        {/* Form */}
        {step === "form" && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4" noValidate>
            {/* Name */}
            <Field
              label={t("form.name")}
              error={errors.fullName}
              id="form-name"
            >
              <input
                id="form-name"
                type="text"
                placeholder={t("form.name_placeholder")}
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                className={inputClass(!!errors.fullName)}
              />
            </Field>

            {/* Email */}
            <Field label={t("form.email")} error={errors.email} id="form-email">
              <input
                id="form-email"
                type="email"
                placeholder={t("form.email_placeholder")}
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className={inputClass(!!errors.email)}
              />
            </Field>

            {/* WhatsApp */}
            <Field label={t("form.whatsapp")} error={errors.whatsapp} id="form-whatsapp">
              <input
                id="form-whatsapp"
                type="tel"
                placeholder={t("form.whatsapp_placeholder")}
                value={form.whatsapp}
                onChange={(e) => update("whatsapp", e.target.value)}
                className={inputClass(!!errors.whatsapp)}
              />
            </Field>

            {/* Platform */}
            <Field label={t("form.platform")} error={errors.platform} id="form-platform">
              <select
                id="form-platform"
                value={form.platform}
                onChange={(e) => update("platform", e.target.value)}
                className={inputClass(!!errors.platform)}
              >
                <option value="">{t("form.platform_placeholder")}</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>

            {/* Niche */}
            <Field label={t("form.niche")} error={errors.niche} id="form-niche">
              <select
                id="form-niche"
                value={form.niche}
                onChange={(e) => update("niche", e.target.value)}
                className={inputClass(!!errors.niche)}
              >
                <option value="">{t("form.niche_placeholder")}</option>
                {NICHES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </Field>

            {/* Source (optional) */}
            <Field label={t("form.source")} id="form-source">
              <select
                id="form-source"
                value={form.source}
                onChange={(e) => update("source", e.target.value)}
                className={inputClass(false)}
              >
                <option value="">{t("form.source_placeholder")}</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>

            {/* Trust badges */}
            <div className="flex items-center gap-3 py-3 px-4 rounded-xl bg-muted/60 border border-border">
              <Shield className="w-4 h-4 text-green-500 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">{t("payment.trust")}</p>
            </div>

            {/* Submit */}
            <button
              id="form-submit-btn"
              type="submit"
              disabled={submitting}
              className="btn-amber w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              {t("form.submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  id,
  children,
}: {
  label: string;
  error?: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}

function inputClass(hasError: boolean) {
  return `w-full px-3.5 py-2.5 rounded-lg border text-sm bg-background focus:outline-none focus:ring-2 transition-all ${
    hasError
      ? "border-red-400 focus:ring-red-300"
      : "border-border focus:border-ring focus:ring-ring/30"
  }`;
}
