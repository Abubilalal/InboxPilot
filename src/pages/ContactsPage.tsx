import { useState, useCallback } from "react";
import { trpc } from "@/providers/trpc";
import {
  Search,
  Plus,
  Upload,
  Eye,
  Trash2,
  Users,
  List,
  Ban,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
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

export default function ContactsPage() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [listFilter, setListFilter] = useState<string>("all");
  const [sort, setSort] = useState<string>("recent");
  const [showAdd, setShowAdd] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showDetail, setShowDetail] = useState<number | null>(null);
  const [showDelete, setShowDelete] = useState<number | null>(null);

  // Add contact form
  const [addEmail, setAddEmail] = useState("");
  const [addFirstName, setAddFirstName] = useState("");
  const [addListIds, setAddListIds] = useState<string[]>([]);

  // Upload state
  const [csvData, setCsvData] = useState<Record<string, string>[] | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [uploadListId, setUploadListId] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  const { data: contactsData } = trpc.contact.list.useQuery({
    page: 1,
    limit: 50,
    search: search || undefined,
    listId: listFilter !== "all" ? Number(listFilter) : undefined,
    sort: sort as "recent" | "name_asc" | "name_desc",
  });

  const { data: listsData } = trpc.contactList.list.useQuery();
  const { data: detailData } = trpc.contact.getById.useQuery(
    { id: showDetail! },
    { enabled: !!showDetail }
  );

  const totalContacts = contactsData?.total ?? 0;

  const createMutation = trpc.contact.create.useMutation({
    onSuccess: () => {
      utils.contact.list.invalidate();
      utils.dashboard.getStats.invalidate();
      setShowAdd(false);
      resetAddForm();
      toast.success("Contact added");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.contact.delete.useMutation({
    onSuccess: () => {
      utils.contact.list.invalidate();
      utils.dashboard.getStats.invalidate();
      setShowDelete(null);
      toast.success("Contact deleted");
    },
  });

  const importMutation = trpc.contact.importCsv.useMutation({
    onSuccess: (result) => {
      utils.contact.list.invalidate();
      utils.contactList.list.invalidate();
      utils.dashboard.getStats.invalidate();
      setIsUploading(false);
      setShowUpload(false);
      setCsvData(null);
      setCsvFileName("");
      toast.success(`Imported ${result.imported} contacts (${result.skipped} skipped)`);
    },
    onError: (err) => {
      setIsUploading(false);
      toast.error(err.message);
    },
  });

  const resetAddForm = () => {
    setAddEmail("");
    setAddFirstName("");
    setAddListIds([]);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setCsvFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data as Record<string, string>[]);
      },
      error: (err) => toast.error(`CSV parse error: ${err.message}`),
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    multiple: false,
  });

  const handleUpload = () => {
    if (!csvData || csvData.length === 0) {
      toast.error("No CSV data to upload");
      return;
    }
    setIsUploading(true);
    importMutation.mutate({
      listId: uploadListId ? Number(uploadListId) : undefined,
      data: csvData,
    });
  };

  return (
    <div>
      <p className="text-sm text-[#666666] -mt-2 mb-5">
        Manage your email contact lists and subscriber data.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5 mb-5">
        {[
          { label: "Total Contacts", value: totalContacts, icon: Users },
          { label: "Lists", value: listsData?.length ?? 0, icon: List },
          { label: "Suppressed", value: 0, icon: Ban },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white border border-[#e0e0e0] rounded p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-full bg-[#f4f7fb] flex items-center justify-center">
              <stat.icon className="w-5 h-5 text-[#1a3a5c]" />
            </div>
            <p className="text-xs text-[#666666] mt-3">{stat.label}</p>
            <p className="text-[32px] font-bold text-[#1a3a5c] leading-tight mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
            <Input
              placeholder="Search by email or name..."
              className="pl-9 w-[300px] h-10 border-[#e0e0e0]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={listFilter} onValueChange={setListFilter}>
            <SelectTrigger className="w-[160px] h-10 border-[#e0e0e0]">
              <SelectValue placeholder="All Lists" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lists</SelectItem>
              {listsData?.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[140px] h-10 border-[#e0e0e0]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recent</SelectItem>
              <SelectItem value="name_asc">Name A-Z</SelectItem>
              <SelectItem value="name_desc">Name Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowUpload(true)}
            className="h-10 border-[#e0e0e0] text-xs font-medium uppercase tracking-wider"
          >
            <Upload className="w-4 h-4 mr-1" /> Upload CSV
          </Button>
          <Button
            onClick={() => setShowAdd(true)}
            className="h-10 bg-[#1a3a5c] hover:bg-[#2a4a6c] text-white text-xs font-medium uppercase tracking-wider"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Contact
          </Button>
        </div>
      </div>

      {/* Contacts Table */}
      {contactsData?.contacts && contactsData.contacts.length > 0 ? (
        <div className="bg-white border border-[#e0e0e0] rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#f4f7fb]">
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  First Name
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Lists
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {contactsData.contacts.map((c) => (
                <tr key={c.id} className="border-t border-[#e8e8e8] hover:bg-[#f4f7fb] transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-[#1a3a5c]">{c.email}</td>
                  <td className="px-4 py-3 text-sm text-[#222222]">{c.firstName || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.lists?.map((list: { id: number; name: string }) => (
                        <span
                          key={list.id}
                          className="px-2 py-0.5 text-[10px] bg-[#f4f7fb] border border-[#e0e0e0] rounded-full text-[#666666]"
                        >
                          {list.name}
                        </span>
                      ))}
                      {(!c.lists || c.lists.length === 0) && (
                        <span className="text-xs text-[#888888]">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 text-xs rounded-full ${
                        c.status === "active"
                          ? "bg-[#2d8a4e]/12 text-[#2d8a4e]"
                          : "bg-[#c0392b]/12 text-[#c0392b]"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowDetail(c.id)}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#f4f7fb] text-[#666666]"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowDelete(c.id)}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#f4f7fb] text-[#666666] hover:text-[#c0392b]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center py-16 bg-white border border-[#e0e0e0] rounded">
          <Users className="w-12 h-12 text-[#888888]" />
          <h3 className="text-base font-semibold text-[#666666] mt-4">No contacts yet</h3>
          <p className="text-sm text-[#888888] mt-1">
            Upload a CSV or add contacts manually.
          </p>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowUpload(true)}
              className="h-10 border-[#e0e0e0]"
            >
              <Upload className="w-4 h-4 mr-1" /> Upload CSV
            </Button>
            <Button
              onClick={() => setShowAdd(true)}
              className="h-10 bg-[#1a3a5c] hover:bg-[#2a4a6c] text-white"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Contact
            </Button>
          </div>
        </div>
      )}

      {/* Add Contact Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#222222]">Add Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#666666]">Email *</Label>
              <Input
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="john@example.com"
                className="mt-1 h-10 border-[#e0e0e0]"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#666666]">First Name</Label>
              <Input
                value={addFirstName}
                onChange={(e) => setAddFirstName(e.target.value)}
                placeholder="John"
                className="mt-1 h-10 border-[#e0e0e0]"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#666666]">Lists</Label>
              <Select value={addListIds[0] || ""} onValueChange={(v) => setAddListIds([v])}>
                <SelectTrigger className="mt-1 h-10 border-[#e0e0e0]">
                  <SelectValue placeholder="Select a list" />
                </SelectTrigger>
                <SelectContent>
                  {listsData?.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.name}
                    </SelectItem>
                  ))}
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
                    firstName: addFirstName || undefined,
                    listIds: addListIds.filter(Boolean).map(Number),
                  })
                }
                disabled={createMutation.isPending}
                className="h-10 bg-[#1a3a5c] hover:bg-[#2a4a6c] text-white"
              >
                Add Contact
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload CSV Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#222222]">Upload Contacts</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {!csvData ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded p-10 text-center cursor-pointer transition-colors ${
                  isDragActive ? "border-[#c9a84c] bg-[#c9a84c]/5" : "border-[#e0e0e0] hover:border-[#1a3a5c]"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-12 h-12 text-[#888888] mx-auto" />
                <p className="text-sm text-[#666666] mt-3">
                  {isDragActive ? "Drop your CSV file here" : "Drop your CSV file here"}
                </p>
                <p className="text-xs text-[#1a3a5c] mt-1">or click to browse</p>
                <p className="text-xs text-[#888888] mt-2">Expected format: email,first_name</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm text-[#222222]">{csvFileName}</span>
                  <button
                    onClick={() => {
                      setCsvData(null);
                      setCsvFileName("");
                    }}
                    className="text-xs text-[#c0392b] hover:underline"
                  >
                    Remove
                  </button>
                </div>
                <p className="text-sm text-[#2d8a4e] mb-3">{csvData.length} rows found</p>

                {/* Preview */}
                {csvData.length > 0 && (
                  <div className="border border-[#e0e0e0] rounded overflow-hidden mb-3 max-h-[160px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[#f4f7fb] sticky top-0">
                        <tr>
                          {Object.keys(csvData[0]).map((k) => (
                            <th key={k} className="px-2 py-1 text-left text-[10px] uppercase text-[#666666]">
                              {k}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-t border-[#e8e8e8]">
                            {Object.values(row).map((v, j) => (
                              <td key={j} className="px-2 py-1 text-[#222222]">{v}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div>
                  <Label className="text-xs uppercase tracking-wider text-[#666666]">Add to List</Label>
                  <Select value={uploadListId} onValueChange={setUploadListId}>
                    <SelectTrigger className="mt-1 h-10 border-[#e0e0e0]">
                      <SelectValue placeholder="Create new list" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Create new list</SelectItem>
                      {listsData?.map((l) => (
                        <SelectItem key={l.id} value={String(l.id)}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="w-full mt-3 h-10 bg-[#c9a84c] hover:bg-[#d4b85c] text-[#222222]"
                >
                  {isUploading ? "Uploading..." : `Upload ${csvData.length} Contacts`}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#222222]">Contact Details</DialogTitle>
          </DialogHeader>
          {detailData && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-[#666666]">Email</Label>
                  <p className="text-sm text-[#1a3a5c]">{detailData.email}</p>
                </div>
                <div>
                  <Label className="text-xs text-[#666666]">First Name</Label>
                  <p className="text-sm text-[#222222]">{detailData.firstName || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-[#666666]">Status</Label>
                  <p className="text-sm">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                        detailData.status === "active"
                          ? "bg-[#2d8a4e]/12 text-[#2d8a4e]"
                          : "bg-[#c0392b]/12 text-[#c0392b]"
                      }`}
                    >
                      {detailData.status}
                    </span>
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-[#666666]">Added</Label>
                  <p className="text-sm text-[#888888]">
                    {new Date(detailData.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#222222]">Delete Contact?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#666666]">This contact will be permanently removed.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowDelete(null)} className="h-10 border-[#e0e0e0]">
              Cancel
            </Button>
            <Button
              onClick={() => showDelete && deleteMutation.mutate({ id: showDelete })}
              className="h-10 bg-[#c0392b] hover:bg-[#a93226] text-white"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
