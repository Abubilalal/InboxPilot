import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { Check, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const { data: settings } = trpc.setting.get.useQuery();

  // Form state
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [unsubMailto, setUnsubMailto] = useState("");
  const [unsubBaseUrl, setUnsubBaseUrl] = useState("");
  const [unsubSecret, setUnsubSecret] = useState("");
  const [defaultDelay, setDefaultDelay] = useState("6");
  const [defaultLimit, setDefaultLimit] = useState("0");
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  }>({ tested: false, success: false, message: "" });

  useEffect(() => {
    if (settings) {
      setSmtpHost(settings.smtpHost || "");
      setSmtpPort(String(settings.smtpPort || 587));
      setSmtpUser(settings.smtpUser || "");
      setSenderName(settings.senderName || "");
      setSenderEmail(settings.senderEmail || "");
      setReplyTo(settings.replyTo || "");
      setUnsubMailto(settings.unsubMailto || "");
      setUnsubBaseUrl(settings.unsubBaseUrl || "");
      setDefaultDelay(String(settings.defaultDelay || 6));
      setDefaultLimit(String(settings.defaultLimit || 0));
    }
  }, [settings]);

  const updateMutation = trpc.setting.update.useMutation({
    onSuccess: () => {
      utils.setting.get.invalidate();
      toast.success("Settings saved");
    },
    onError: (err) => toast.error(err.message),
  });

  const testMutation = trpc.setting.testConnection.useMutation({
    onSuccess: (result) => {
      setConnectionStatus({
        tested: true,
        success: result.success,
        message: result.message,
      });
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    },
  });

  const handleSave = () => {
    const payload: Record<string, unknown> = {
      smtpHost,
      smtpPort: Number(smtpPort) || 587,
      smtpUser,
      senderName,
      senderEmail,
      replyTo: replyTo || null,
      unsubMailto: unsubMailto || null,
      unsubBaseUrl: unsubBaseUrl || null,
      defaultDelay: Number(defaultDelay) || 6,
      defaultLimit: Number(defaultLimit) || 0,
    };

    if (smtpPass) {
      payload.smtpPass = smtpPass;
    }
    if (unsubSecret) {
      payload.unsubSecret = unsubSecret;
    }

    updateMutation.mutate(payload);
  };

  const SectionTitle = ({ title }: { title: string }) => (
    <div className="mt-6 mb-4">
      <h2 className="text-xl font-semibold text-[#222222]">{title}</h2>
      <div className="h-[3px] w-[40px] bg-[#c9a84c] mt-2" />
    </div>
  );

  return (
    <div className="max-w-[800px]">
      <p className="text-sm text-[#666666] -mt-2 mb-5">
        Configure your SMTP server, sender details, and campaign defaults.
      </p>

      {/* SMTP Settings */}
      <SectionTitle title="SMTP Configuration" />
      <div className="bg-white border border-[#e0e0e0] rounded p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-[#666666]">SMTP Host</Label>
            <Input
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              placeholder="smtp.zoho.com"
              className="mt-1 h-10 border-[#e0e0e0]"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-[#666666]">SMTP Port</Label>
            <Input
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
              placeholder="587"
              className="mt-1 h-10 border-[#e0e0e0] w-[120px]"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-[#666666]">SMTP Username</Label>
          <Input
            value={smtpUser}
            onChange={(e) => setSmtpUser(e.target.value)}
            placeholder="your-email@domain.com"
            className="mt-1 h-10 border-[#e0e0e0]"
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-[#666666]">SMTP Password</Label>
          <Input
            type="password"
            value={smtpPass}
            onChange={(e) => setSmtpPass(e.target.value)}
            placeholder={settings?.smtpPass === null ? "••••••••" : "Enter password"}
            className="mt-1 h-10 border-[#e0e0e0]"
          />
          <p className="text-xs text-[#888888] mt-1">Leave blank to keep existing password</p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
            className="h-10 border-[#e0e0e0]"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${testMutation.isPending ? "animate-spin" : ""}`} />
            Test Connection
          </Button>
          {connectionStatus.tested && (
            <div className="flex items-center gap-1.5">
              {connectionStatus.success ? (
                <>
                  <Check className="w-4 h-4 text-[#2d8a4e]" />
                  <span className="text-sm text-[#2d8a4e]">{connectionStatus.message}</span>
                </>
              ) : (
                <>
                  <X className="w-4 h-4 text-[#c0392b]" />
                  <span className="text-sm text-[#c0392b]">{connectionStatus.message}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sender Details */}
      <SectionTitle title="Sender Details" />
      <div className="bg-white border border-[#e0e0e0] rounded p-6 space-y-4">
        <div>
          <Label className="text-xs uppercase tracking-wider text-[#666666]">Sender Name</Label>
          <Input
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Lexi Translation Lab"
            className="mt-1 h-10 border-[#e0e0e0]"
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-[#666666]">Sender Email</Label>
          <Input
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            placeholder="info@lexilab.in"
            className="mt-1 h-10 border-[#e0e0e0]"
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-[#666666]">Reply-To Email</Label>
          <Input
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            placeholder="optional"
            className="mt-1 h-10 border-[#e0e0e0]"
          />
        </div>
      </div>

      {/* Unsubscribe Settings */}
      <SectionTitle title="Unsubscribe Handling" />
      <div className="bg-white border border-[#e0e0e0] rounded p-6 space-y-4">
        <div>
          <Label className="text-xs uppercase tracking-wider text-[#666666]">Unsubscribe Email</Label>
          <Input
            value={unsubMailto}
            onChange={(e) => setUnsubMailto(e.target.value)}
            placeholder="unsubscribe@lexilab.in"
            className="mt-1 h-10 border-[#e0e0e0]"
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-[#666666]">Unsubscribe URL</Label>
          <Input
            value={unsubBaseUrl}
            onChange={(e) => setUnsubBaseUrl(e.target.value)}
            placeholder="https://www.lexilab.in/unsubscribe"
            className="mt-1 h-10 border-[#e0e0e0]"
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-[#666666]">Secret Key</Label>
          <Input
            type="password"
            value={unsubSecret}
            onChange={(e) => setUnsubSecret(e.target.value)}
            placeholder="For HMAC signature"
            className="mt-1 h-10 border-[#e0e0e0]"
          />
        </div>
      </div>

      {/* Campaign Defaults */}
      <SectionTitle title="Campaign Defaults" />
      <div className="bg-white border border-[#e0e0e0] rounded p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-[#666666]">Default Delay (seconds)</Label>
            <Input
              type="number"
              min={1}
              max={300}
              value={defaultDelay}
              onChange={(e) => setDefaultDelay(e.target.value)}
              className="mt-1 h-10 border-[#e0e0e0]"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-[#666666]">Default Daily Limit</Label>
            <Input
              type="number"
              min={0}
              value={defaultLimit}
              onChange={(e) => setDefaultLimit(e.target.value)}
              className="mt-1 h-10 border-[#e0e0e0]"
            />
            <p className="text-xs text-[#888888] mt-1">0 = no limit</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-8 pb-8">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="h-12 px-8 bg-[#1a3a5c] hover:bg-[#2a4a6c] text-white text-sm font-medium uppercase tracking-wider"
        >
          {updateMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
