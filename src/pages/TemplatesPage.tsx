import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Plus, Pencil, Trash2, FileText, Code, Eye } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TOKEN_PILLS = ["{{first_name}}", "{{email}}", "{{unsubscribe_url}}"];

export default function TemplatesPage() {
  const utils = trpc.useUtils();
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showDelete, setShowDelete] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [textBody, setTextBody] = useState("");
  const [activeTab, setActiveTab] = useState("html");
  const [previewData, setPreviewData] = useState(false);

  const { data: templates } = trpc.template.list.useQuery({});

  const createMutation = trpc.template.create.useMutation({
    onSuccess: () => {
      utils.template.list.invalidate();
      setShowEditor(false);
      resetForm();
      toast.success("Template saved");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.template.update.useMutation({
    onSuccess: () => {
      utils.template.list.invalidate();
      setShowEditor(false);
      resetForm();
      toast.success("Template updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.template.delete.useMutation({
    onSuccess: () => {
      utils.template.list.invalidate();
      setShowDelete(null);
      toast.success("Template deleted");
    },
  });

  const resetForm = () => {
    setName("");
    setSubject("");
    setHtmlBody("");
    setTextBody("");
    setEditingId(null);
    setPreviewData(false);
  };

  const openEditor = (template?: { id: number; name: string; subject: string; htmlBody: string | null; textBody: string }) => {
    if (template) {
      setEditingId(template.id);
      setName(template.name);
      setSubject(template.subject);
      setHtmlBody(template.htmlBody || "");
      setTextBody(template.textBody);
    } else {
      resetForm();
    }
    setShowEditor(true);
  };

  const handleSave = () => {
    if (!name || !subject || !textBody) {
      toast.error("Name, subject, and text body are required");
      return;
    }
    const payload = {
      name,
      subject,
      htmlBody: htmlBody || undefined,
      textBody,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const insertToken = (token: string) => {
    if (activeTab === "subject") {
      setSubject((s) => s + token);
    } else if (activeTab === "html") {
      setHtmlBody((b) => b + token);
    } else if (activeTab === "text") {
      setTextBody((b) => b + token);
    }
  };

  const renderPreview = (text: string) => {
    if (!previewData) return text;
    return text
      .replace(/\{\{\s*first_name\s*\}\}/g, "John")
      .replace(/\{\{\s*email\s*\}\}/g, "john@example.com")
      .replace(/\{\{\s*unsubscribe_url\s*\}\}/g, "https://lexilab.in/unsubscribe");
  };

  return (
    <div>
      <p className="text-sm text-[#666666] -mt-2 mb-5">
        Create and edit email templates with personalization tokens.
      </p>

      <Button
        onClick={() => openEditor()}
        className="h-10 bg-[#c9a84c] hover:bg-[#d4b85c] text-[#222222] text-xs font-medium uppercase tracking-wider mb-5"
      >
        <Plus className="w-4 h-4 mr-1" /> New Template
      </Button>

      {/* Templates Grid */}
      {templates && templates.length > 0 ? (
        <div className="grid grid-cols-3 gap-5">
          {templates.map((t) => (
            <div
              key={t.id}
              onClick={() => openEditor(t)}
              className="bg-white border border-[#e0e0e0] rounded p-5 h-[200px] cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:border-[#2a4a6c] relative group"
            >
              {/* Actions */}
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditor(t);
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded bg-[#f4f7fb] hover:bg-[#e8e8e8]"
                >
                  <Pencil className="w-3.5 h-3.5 text-[#666666]" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDelete(t.id);
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded bg-[#f4f7fb] hover:bg-[#c0392b]/10"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#666666]" />
                </button>
              </div>

              {/* Preview thumbnail */}
              <div className="h-[100px] bg-[#f4f7fb] rounded overflow-hidden border border-[#e8e8e8]">
                {t.htmlBody ? (
                  <div
                    className="w-full h-full overflow-hidden p-2 text-[8px] leading-tight text-[#222222]"
                    dangerouslySetInnerHTML={{ __html: t.htmlBody.substring(0, 500) }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-[#888888] p-3 overflow-hidden">
                    {t.textBody.substring(0, 200)}
                  </div>
                )}
              </div>

              <h3 className="text-sm font-medium text-[#1a3a5c] mt-3 truncate">{t.name}</h3>
              <p className="text-xs text-[#666666] truncate mt-0.5">{t.subject}</p>
              <p className="text-xs text-[#888888] mt-1">
                {t.htmlBody ? "HTML + Text" : "Text only"}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center py-20 bg-white border border-[#e0e0e0] rounded">
          <FileText className="w-12 h-12 text-[#888888]" />
          <h3 className="text-base font-semibold text-[#666666] mt-4">No templates yet</h3>
          <p className="text-sm text-[#888888] mt-1">Create a template to use in your campaigns.</p>
          <Button
            onClick={() => openEditor()}
            className="mt-4 h-10 bg-[#c9a84c] hover:bg-[#d4b85c] text-[#222222]"
          >
            <Plus className="w-4 h-4 mr-1" /> Create Template
          </Button>
        </div>
      )}

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={(v) => { if (!v) { setShowEditor(false); resetForm(); } }}>
        <DialogContent className="max-w-[960px] h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#222222]">
              {editingId ? "Edit Template" : "Create Template"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex flex-col min-h-0 pt-2">
            {/* Subject */}
            <div className="mb-3">
              <Label className="text-xs uppercase tracking-wider text-[#666666]">Subject Line</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Hello {{first_name}}"
                className="mt-1 h-10 border-[#e0e0e0]"
              />
            </div>

            {/* Token Toolbar */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs text-[#666666]">Insert Token:</span>
              {TOKEN_PILLS.map((token) => (
                <button
                  key={token}
                  onClick={() => insertToken(token)}
                  className="px-3 py-1 text-xs bg-[#f4f7fb] border border-[#e0e0e0] rounded-full text-[#1a3a5c] hover:bg-[#e8e8e8] transition-colors"
                >
                  {token}
                </button>
              ))}
              <div className="flex-1" />
              <label className="flex items-center gap-1.5 text-xs text-[#666666] cursor-pointer">
                <input
                  type="checkbox"
                  checked={previewData}
                  onChange={(e) => setPreviewData(e.target.checked)}
                  className="w-3.5 h-3.5"
                />
                Render with sample data
              </label>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="bg-[#f4f7fb]">
                <TabsTrigger value="html" className="text-xs">
                  <Code className="w-3.5 h-3.5 mr-1" /> HTML
                </TabsTrigger>
                <TabsTrigger value="text" className="text-xs">
                  <FileText className="w-3.5 h-3.5 mr-1" /> Text
                </TabsTrigger>
                <TabsTrigger value="preview" className="text-xs">
                  <Eye className="w-3.5 h-3.5 mr-1" /> Preview
                </TabsTrigger>
              </TabsList>

              <TabsContent value="html" className="flex-1 min-h-0 mt-2">
                <textarea
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  placeholder="<!DOCTYPE html>..."
                  className="w-full h-full min-h-[300px] p-4 bg-[#f4f7fb] border border-[#e0e0e0] rounded text-sm font-mono leading-relaxed resize-none focus:outline-none focus:border-[#1a3a5c] focus:ring-1 focus:ring-[#1a3a5c]/10"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, lineHeight: "20px" }}
                />
              </TabsContent>

              <TabsContent value="text" className="flex-1 min-h-0 mt-2">
                <textarea
                  value={textBody}
                  onChange={(e) => setTextBody(e.target.value)}
                  placeholder="Plain text version of your email..."
                  className="w-full h-full min-h-[300px] p-4 bg-[#f4f7fb] border border-[#e0e0e0] rounded text-sm font-mono leading-relaxed resize-none focus:outline-none focus:border-[#1a3a5c] focus:ring-1 focus:ring-[#1a3a5c]/10"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, lineHeight: "20px" }}
                />
              </TabsContent>

              <TabsContent value="preview" className="flex-1 min-h-0 mt-2 overflow-y-auto">
                {htmlBody ? (
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <p className="text-xs text-[#666666] mb-1">Desktop</p>
                      <div className="border border-[#e0e0e0] rounded overflow-hidden">
                        <iframe
                          srcDoc={renderPreview(htmlBody)}
                          className="w-full min-h-[400px] bg-white"
                          title="Preview"
                          sandbox=""
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border border-[#e0e0e0] rounded p-6 bg-white whitespace-pre-wrap text-sm text-[#222222]">
                    {renderPreview(textBody) || "No content to preview"}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Name + Actions */}
            <div className="flex items-end gap-3 mt-4 pt-3 border-t border-[#e8e8e8]">
              <div className="flex-1">
                <Label className="text-xs uppercase tracking-wider text-[#666666]">Template Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Template"
                  className="mt-1 h-10 border-[#e0e0e0]"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => { setShowEditor(false); resetForm(); }}
                className="h-10 border-[#e0e0e0]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="h-10 bg-[#1a3a5c] hover:bg-[#2a4a6c] text-white text-xs font-medium uppercase tracking-wider"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingId
                  ? "Update Template"
                  : "Save Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#222222]">Delete Template?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#666666]">This template will be permanently removed.</p>
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
