import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Crown,
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { DuplicateGroup, KeywordEntry } from "./backend.d";
import {
  useAddEntries,
  useAddEntry,
  useAnalyzeDuplicates,
  useCleanDuplicates,
  useClearAll,
  useDeleteEntry,
  useGetAllEntries,
} from "./hooks/useQueries";

type RowStatus = "normal" | "winner" | "duplicate";

function getRowStatus(
  entry: KeywordEntry,
  duplicateGroups: DuplicateGroup[],
): RowStatus {
  for (const group of duplicateGroups) {
    if (group.winner.id === entry.id) return "winner";
    if (group.duplicates.some((d) => d.id === entry.id)) return "duplicate";
  }
  return "normal";
}

export default function App() {
  const [keywordInput, setKeywordInput] = useState("");
  const [frequencyInput, setFrequencyInput] = useState("");
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [analysisState, setAnalysisState] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: entries = [], isLoading: entriesLoading } = useGetAllEntries();
  const addEntry = useAddEntry();
  const addEntries = useAddEntries();
  const deleteEntry = useDeleteEntry();
  const analyzeDuplicates = useAnalyzeDuplicates();
  const cleanDuplicates = useCleanDuplicates();
  const clearAll = useClearAll();

  const resetAnalysis = useCallback(() => {
    setDuplicateGroups([]);
    setAnalysisState("idle");
  }, []);

  // Add a single row
  const handleAddRow = async () => {
    const kw = keywordInput.trim();
    const freq = Number.parseInt(frequencyInput.trim(), 10);
    if (!kw) {
      toast.error("Введите ключевой запрос");
      return;
    }
    if (Number.isNaN(freq) || freq < 0) {
      toast.error("Введите корректную частоту (целое число ≥ 0)");
      return;
    }
    try {
      await addEntry.mutateAsync({ keyword: kw, frequency: BigInt(freq) });
      setKeywordInput("");
      setFrequencyInput("");
      resetAnalysis();
      toast.success("Запрос добавлен");
    } catch {
      toast.error("Ошибка при добавлении");
    }
  };

  // Handle file import
  const handleFileImport = useCallback(
    async (file: File) => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<(string | number)[]>(worksheet, {
          header: 1,
          defval: "",
        }) as (string | number)[][];

        const parsed: Array<[string, bigint]> = [];
        for (const row of rows) {
          if (!row || row.length < 2) continue;
          const keyword = String(row[0] ?? "").trim();
          const rawFreq = row[1];
          const freq =
            typeof rawFreq === "number"
              ? rawFreq
              : Number.parseInt(String(rawFreq), 10);
          // Skip header rows (non-numeric frequency)
          if (!keyword || Number.isNaN(freq)) continue;
          parsed.push([keyword, BigInt(Math.max(0, Math.round(freq)))]);
        }

        if (parsed.length === 0) {
          toast.error(
            "Файл не содержит данных (ожидается: колонка 1 — запрос, колонка 2 — частота)",
          );
          return;
        }

        await addEntries.mutateAsync(parsed);
        resetAnalysis();
        toast.success(`Загружено ${parsed.length} строк`);
      } catch (err) {
        console.error(err);
        toast.error("Ошибка при чтении файла");
      }
    },
    [addEntries, resetAnalysis],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileImport(file);
    }
    // Reset input so same file can be re-imported
    e.target.value = "";
  };

  // Analyze duplicates
  const handleAnalyze = async () => {
    setAnalysisState("loading");
    try {
      const groups = await analyzeDuplicates.mutateAsync();
      setDuplicateGroups(groups);
      setAnalysisState("done");
      if (groups.length === 0) {
        toast.success("Дублей не найдено — список чистый!");
      } else {
        const totalDuplicates = groups.reduce(
          (sum, g) => sum + g.duplicates.length,
          0,
        );
        toast.warning(
          `Найдено ${totalDuplicates} дублей в ${groups.length} группах`,
        );
      }
    } catch {
      setAnalysisState("error");
      toast.error("Ошибка при анализе");
    }
  };

  // Clean duplicates
  const handleClean = async () => {
    try {
      await cleanDuplicates.mutateAsync();
      setDuplicateGroups([]);
      setAnalysisState("idle");
      toast.success("Дубли удалены");
    } catch {
      toast.error("Ошибка при очистке");
    }
  };

  // Export to xlsx
  const handleExport = () => {
    if (entries.length === 0) {
      toast.error("Нет данных для экспорта");
      return;
    }
    const wsData = [
      ["Ключевой запрос", "Частота"],
      ...entries.map((e) => [e.keyword, Number(e.frequency)]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    // Set column widths
    ws["!cols"] = [{ wch: 50 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Keywords");
    XLSX.writeFile(wb, "keywords_cleaned.xlsx");
    toast.success("Файл сохранён: keywords_cleaned.xlsx");
  };

  // Delete single entry
  const handleDelete = async (id: bigint) => {
    try {
      await deleteEntry.mutateAsync(id);
      resetAnalysis();
    } catch {
      toast.error("Ошибка при удалении");
    }
  };

  // Clear all
  const handleClearAll = async () => {
    try {
      await clearAll.mutateAsync();
      resetAnalysis();
      toast.success("Таблица очищена");
    } catch {
      toast.error("Ошибка при очистке");
    }
  };

  const totalDuplicates = duplicateGroups.reduce(
    (sum, g) => sum + g.duplicates.length,
    0,
  );
  const hasDuplicates = analysisState === "done" && duplicateGroups.length > 0;

  const isImporting = addEntries.isPending;
  const isAnalyzing = analysisState === "loading";
  const isCleaning = cleanDuplicates.isPending;
  const isClearing = clearAll.isPending;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b border-border bg-card shadow-xs sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
                <Search className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight text-foreground leading-tight">
                  Дубли ключевых запросов
                </h1>
                <p className="text-xs text-muted-foreground">
                  Анализ и очистка семантического ядра
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {entries.length > 0 && (
                <span className="bg-muted px-2 py-0.5 rounded-full font-mono">
                  {entries.length} запросов
                </span>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 space-y-5">
          {/* Add row form */}
          <section className="bg-card border border-border rounded-lg shadow-xs">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Plus className="w-3.5 h-3.5 text-primary" />
                Добавить запрос вручную
              </h2>
            </div>
            <div className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  data-ocid="add_row.input"
                  placeholder="Ключевой запрос..."
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddRow();
                  }}
                  className="flex-1 text-sm"
                  disabled={addEntry.isPending}
                />
                <Input
                  data-ocid="add_row.frequency_input"
                  placeholder="Частота"
                  type="number"
                  min="0"
                  value={frequencyInput}
                  onChange={(e) => setFrequencyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddRow();
                  }}
                  className="w-full sm:w-32 text-sm font-mono"
                  disabled={addEntry.isPending}
                />
                <Button
                  data-ocid="add_row.submit_button"
                  onClick={handleAddRow}
                  disabled={addEntry.isPending}
                  size="sm"
                  className="shrink-0"
                >
                  {addEntry.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span className="ml-1.5">Добавить</span>
                </Button>
              </div>
            </div>
          </section>

          {/* Toolbar */}
          <section className="bg-card border border-border rounded-lg shadow-xs">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Инструменты
              </h2>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {/* File import */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                  aria-label="Импорт файла"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      data-ocid="toolbar.upload_button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isImporting}
                    >
                      {isImporting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span className="ml-1.5">
                        {isImporting ? "Загрузка..." : "Импорт файла"}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Загрузить .xlsx или .csv (колонка 1 — запрос, колонка 2 —
                      частота)
                    </p>
                  </TooltipContent>
                </Tooltip>

                {/* Analyze */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      data-ocid="toolbar.analyze_button"
                      variant="outline"
                      size="sm"
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || entries.length === 0}
                    >
                      {isAnalyzing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                      <span className="ml-1.5">
                        {isAnalyzing ? "Анализ..." : "Найти дубли"}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Найти строки с одинаковым ключевым запросом</p>
                  </TooltipContent>
                </Tooltip>

                {/* Clean */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      data-ocid="toolbar.clean_button"
                      size="sm"
                      onClick={handleClean}
                      disabled={!hasDuplicates || isCleaning}
                      className="bg-success text-success-foreground hover:bg-success/90 disabled:opacity-40"
                    >
                      {isCleaning ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span className="ml-1.5">
                        {isCleaning ? "Очистка..." : "Очистить дубли"}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Удалить дубли, оставив строки с наибольшей частотой</p>
                  </TooltipContent>
                </Tooltip>

                {/* Export */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      data-ocid="toolbar.export_button"
                      variant="outline"
                      size="sm"
                      onClick={handleExport}
                      disabled={entries.length === 0}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="ml-1.5">Скачать .xlsx</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Экспортировать текущий список в Excel</p>
                  </TooltipContent>
                </Tooltip>

                {/* Clear all */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      data-ocid="toolbar.clear_button"
                      variant="outline"
                      size="sm"
                      disabled={isClearing || entries.length === 0}
                      className="text-destructive border-destructive/30 hover:bg-destructive/5"
                    >
                      {isClearing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span className="ml-1.5">Очистить всё</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Очистить все данные?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Все {entries.length} записей будут удалены без
                        возможности восстановления.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-ocid="clear_all.cancel_button">
                        Отмена
                      </AlertDialogCancel>
                      <AlertDialogAction
                        data-ocid="clear_all.confirm_button"
                        onClick={handleClearAll}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Удалить всё
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </section>

          {/* Analysis status banner */}
          <AnimatePresence mode="wait">
            {analysisState === "loading" && (
              <motion.div
                key="loading"
                data-ocid="analysis.loading_state"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-3 px-4 py-3 bg-muted border border-border rounded-lg text-sm"
              >
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Анализируем список на дубли...</span>
              </motion.div>
            )}

            {analysisState === "error" && (
              <motion.div
                key="error"
                data-ocid="analysis.error_state"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-3 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Ошибка при анализе. Попробуйте ещё раз.</span>
                <button
                  onClick={() => setAnalysisState("idle")}
                  className="ml-auto hover:opacity-70"
                  aria-label="Закрыть"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {analysisState === "done" && duplicateGroups.length === 0 && (
              <motion.div
                key="no-dupes"
                data-ocid="analysis.success_state"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-3 px-4 py-3 bg-success/10 border border-success/20 rounded-lg text-sm text-success"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="font-medium">
                  Дублей не найдено — список чистый!
                </span>
                <button
                  onClick={() => setAnalysisState("idle")}
                  className="ml-auto hover:opacity-70"
                  aria-label="Закрыть"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {analysisState === "done" && duplicateGroups.length > 0 && (
              <motion.div
                key="found-dupes"
                data-ocid="analysis.success_state"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-wrap items-center gap-3 px-4 py-3 bg-warning/10 border border-warning/20 rounded-lg text-sm"
              >
                <Copy className="w-4 h-4 text-warning shrink-0" />
                <span className="font-medium">
                  Найдено{" "}
                  <span className="text-warning font-bold">
                    {totalDuplicates}
                  </span>{" "}
                  {totalDuplicates === 1
                    ? "дубль"
                    : totalDuplicates < 5
                      ? "дубля"
                      : "дублей"}{" "}
                  в{" "}
                  <span className="text-warning font-bold">
                    {duplicateGroups.length}
                  </span>{" "}
                  {duplicateGroups.length === 1
                    ? "группе"
                    : duplicateGroups.length < 5
                      ? "группах"
                      : "группах"}
                </span>
                <div className="flex gap-2 ml-auto flex-wrap">
                  <Badge
                    variant="outline"
                    className="text-xs border-warning/30 text-warning"
                  >
                    <Crown className="w-3 h-3 mr-1" />
                    зелёный — оставить
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs border-destructive/30 text-destructive"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    красный — удалить
                  </Badge>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Data table */}
          <section className="bg-card border border-border rounded-lg shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
                Список ключевых запросов
              </h2>
              {entries.length > 0 && (
                <span className="text-xs text-muted-foreground font-mono">
                  {entries.length} строк
                </span>
              )}
            </div>

            {/* Table header */}
            {entries.length > 0 && (
              <div className="grid grid-cols-[3fr_1fr_auto] gap-0 border-b border-border bg-muted/50">
                <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Ключевой запрос
                </div>
                <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">
                  Частота
                </div>
                <div className="px-4 py-2 w-10" />
              </div>
            )}

            {/* Loading */}
            {entriesLoading && (
              <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Загрузка данных...</span>
              </div>
            )}

            {/* Empty state */}
            {!entriesLoading && entries.length === 0 && (
              <div
                data-ocid="table.empty_state"
                className="flex flex-col items-center justify-center py-16 gap-3 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Список пуст
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Добавьте запросы вручную или загрузите файл .xlsx/.csv
                  </p>
                </div>
              </div>
            )}

            {/* Rows */}
            {!entriesLoading && entries.length > 0 && (
              <div className="divide-y divide-border">
                <AnimatePresence initial={false}>
                  {entries.map((entry, index) => {
                    const status = getRowStatus(entry, duplicateGroups);
                    return (
                      <motion.div
                        key={String(entry.id)}
                        data-ocid={`table.row.${index + 1}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.15 }}
                        className={[
                          "grid grid-cols-[3fr_1fr_auto] items-center gap-0 transition-colors",
                          status === "winner" && "row-winner",
                          status === "duplicate" && "row-duplicate",
                          status === "normal" && "row-normal hover:bg-muted/40",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <div className="px-4 py-2.5 flex items-center gap-2 min-w-0">
                          {status === "winner" && (
                            <Crown
                              className="w-3.5 h-3.5 text-success shrink-0"
                              aria-label="Оставить"
                            />
                          )}
                          {status === "duplicate" && (
                            <Copy
                              className="w-3.5 h-3.5 text-destructive shrink-0"
                              aria-label="Дубль"
                            />
                          )}
                          <span
                            className="text-sm truncate"
                            title={entry.keyword}
                          >
                            {entry.keyword}
                          </span>
                        </div>
                        <div className="px-4 py-2.5 text-right">
                          <span className="text-sm font-mono text-muted-foreground">
                            {Number(entry.frequency).toLocaleString("ru-RU")}
                          </span>
                        </div>
                        <div className="px-2 py-2 flex items-center justify-center w-10">
                          <button
                            data-ocid={`table.delete_button.${index + 1}`}
                            onClick={() => handleDelete(entry.id)}
                            disabled={deleteEntry.isPending}
                            aria-label={`Удалить «${entry.keyword}»`}
                            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                            type="button"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-border mt-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()}. Built with ❤️ using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              caffeine.ai
            </a>
          </div>
        </footer>

        <Toaster richColors position="top-right" />
      </div>
    </TooltipProvider>
  );
}
