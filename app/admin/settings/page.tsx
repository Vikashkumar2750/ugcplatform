"use client";

import { useState } from "react";
import { Globe, Bell, Shield, Save, RefreshCw } from "lucide-react";

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    platformName: "ContentIQ",
    contactEmail: "support@techaasvik.in",
    whatsapp: "+91 78270 24726",
    maintenanceMode: false,
    emailNotifications: true,
    newUserAlert: true,
    failedPaymentAlert: true,
    ticketAlert: true,
  });

  const update = (key: string, value: any) => setSettings(s => ({ ...s, [key]: value }));
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-heading text-2xl font-bold text-zinc-100">Platform Settings</h1>
        <p className="text-zinc-500 text-sm">Global configuration for ContentIQ platform</p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
        <h2 className="font-semibold text-zinc-100 flex items-center gap-2"><Globe className="w-4 h-4 text-blue-400" /> General</h2>
        {[
          { label: "Platform Name", key: "platformName", type: "text" },
          { label: "Support Email", key: "contactEmail", type: "email" },
          { label: "WhatsApp Contact", key: "whatsapp", type: "tel" },
        ].map(f => (
          <div key={f.key} className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">{f.label}</label>
            <input type={f.type} value={(settings as any)[f.key]}
              onChange={e => update(f.key, e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30" />
          </div>
        ))}
        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="text-sm font-medium text-zinc-300">Maintenance Mode</p>
            <p className="text-xs text-zinc-500">Users will see maintenance page</p>
          </div>
          <button onClick={() => update("maintenanceMode", !settings.maintenanceMode)}
            className={`w-12 h-6 rounded-full transition-colors ${settings.maintenanceMode ? "bg-red-500" : "bg-zinc-700"}`}>
            <div className={`w-5 h-5 rounded-full bg-white transition-transform mx-0.5 ${settings.maintenanceMode ? "translate-x-6" : "translate-x-0"}`} />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
        <h2 className="font-semibold text-zinc-100 flex items-center gap-2"><Bell className="w-4 h-4 text-amber-400" /> Notifications</h2>
        {[
          { label: "Email notifications", key: "emailNotifications" },
          { label: "New user signup alert", key: "newUserAlert" },
          { label: "Failed payment alert", key: "failedPaymentAlert" },
          { label: "New support ticket alert", key: "ticketAlert" },
        ].map(n => (
          <div key={n.key} className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">{n.label}</span>
            <button onClick={() => update(n.key, !(settings as any)[n.key])}
              className={`w-10 h-5 rounded-full transition-colors ${(settings as any)[n.key] ? "bg-amber-500" : "bg-zinc-700"}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-0.5 ${(settings as any)[n.key] ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-3">
        <h2 className="font-semibold text-zinc-100 flex items-center gap-2"><Shield className="w-4 h-4 text-red-400" /> Admin Credentials</h2>
        <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-500 space-y-1">
          <p>Email: <span className="text-zinc-300 font-mono">admin@techaasvik.in</span></p>
          <p>Password: Set via <span className="text-amber-400 font-mono">ADMIN_PASSWORD</span> env variable</p>
          <p className="text-red-400 mt-2">⚠ Change password in .env before production deployment</p>
        </div>
      </div>

      <button onClick={save} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition ${saved ? "bg-green-500 text-white" : "bg-red-500 text-white hover:bg-red-400"}`}>
        {saved ? <><RefreshCw className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Settings</>}
      </button>
    </div>
  );
}
