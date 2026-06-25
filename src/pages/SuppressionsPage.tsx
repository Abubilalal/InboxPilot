import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Ban, Plus, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SuppressionsPage() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showDelete, setShowDelete] = useState<number | null>(null);

  const [addEmail, setAddEmail] = useState("");
  const [addReason, setAddReason] = useState<string>("manual");

  const { data: suppressionData } = trpc.suppression.list.useQuery({
    page: 1,
    limit: 50,
    search: search || undefined,
  });

  const createMutation = trpc.suppression.create.useMutation({
    onSuccess: () => {
      utils.suppression.list.invalidate();
      utils.contact.list.invalidate();
      utils.dashboard.getStats.invalidate();
      setShowAdd(false);
      setAddEmail("");
      setAddReason("manual");
      toast.success("Email added to suppression list");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.suppression.delete.useMutation({
    onSuccess: () => {
      utils.suppression.list.invalidate();
      utils.contact.list.invalidate();
      setShowDelete(null);
      toast.success("Email removed from suppression list");
    },
  });

  const reasonBadgeClass = (reason: string) => {
    switch (reason) {
      case "unsubscribed":
        return "bg-[#e67e22]/12 text-[#e67e22]";
      case "bounced":
        return "bg-[#c0392b]/12 text-[#c0392b]";
      default:
        return "bg-[#f4f7fb] text-[#666666]";
    }
  };

  return (
    <div>
      <p className="text-sm text-[#666666] -mt-2 mb-5">
        Emails that have unsubscribed or bounced. These contacts are automatically excluded from campaigns.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        {[
          { label: "Total Suppressed", value: suppressionData?.total ?? 0, icon: Ban },
          { label: "Added This Month", value: 0, icon: Ban },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white border border-[#e0e0e0] rounded p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-full bg-[#f4f7fb] flex items-center justify-center">
              <stat.icon className="w-5 h-5 text-[#c0392b]" />
            </div>
            <p className="text-xs text-[#666666] mt-3">{stat.label}</p>
            <p className="text-[32px] font-bold text-[#1a3a5c] leading-tight mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
          <Input
            placeholder="Search email..."
            className="pl-9 w-[300px] h-10 border-[#e0e0e0]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          onClick={() => setShowAdd(true)}
          className="h-10 bg-[#1a3a5c] hover:bg-[#2a4a6c] text-white text-xs font-medium uppercase tracking-wider"
        >
          <Plus className="w-4 h-4 mr-1" /> Add Email
        </Button>
      </div>

      {/* Suppressions Table */}
      {suppressionData?.suppressions && suppressionData.suppressions.length > 0 ? (
        <div className="bg-white border border-[#e0e0e0] rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#f4f7fb]">
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Reason
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Source
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Added
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {suppressionData.suppressions.map((s) => (
                <tr key={s.id} className="border-t border-[#e8e8e8] hover:bg-[#f4f7fb] transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-[#c0392b]">{s.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 text-xs rounded-full ${reasonBadgeClass(s.reason)}`}>
                      {s.reason}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#888888]">{s.source || "—"}</td>
                  <td className="px-4 py-3 text-xs text-[#888888]">
                    {format(new Date(s.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setShowDelete(s.id)}
                      className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#c0392b]/10 text-[#666666] hover:text-[#c0392b]"
                      title="Remove from suppression"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center py-16 bg-white border border-[#e0e0e0] rounded">
          <Ban className="w-12 h-12 text-[#888888]" />
          <h3 className="text-base font-semibold text-[#666666] mt-4">No suppressed emails</h3>
          <p className="text-sm text-[#888888] mt-1">
            Suppressed emails will appear here.
          </p>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#222222]">Add to Suppression</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#666666]">Email</Label>
              <Input
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="email@example.com"
                className="mt-1 h-10 border-[#e0e0e0]"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#666666]">Reason</Label>
              <Select value={addReason} onValueChange={setAddReason}>
                <SelectTrigger className="mt-1 h-10 border-[#e0e0e0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAdd(false)} className="h-10 border-[#e0e0e0]">
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createMutation.mutate({
                    email: addEmail,
                    reason: addReason as "unsubscribed" | "bounced" | "manual",
                  })
                }
                disabled={createMutation.isPending}
                className="h-10 bg-[#1a3a5c] hover:bg-[#2a4a6c] text-white"
              >
                Add to Suppression
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Dialog */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#222222]">Remove from Suppression?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#666666]">
            This email will be eligible to receive campaigns again.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowDelete(null)} className="h-10 border-[#e0e0e0]">
              Cancel
            </Button>
            <Button
              onClick={() => showDelete && deleteMutation.mutate({ id: showDelete })}
              className="h-10 bg-[#c0392b] hover:bg-[#a93226] text-white"
            >
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
