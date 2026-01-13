"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button, GhostButton, SecondaryButton } from "@/components/Button";
import { Select } from "@/components/Select";
import { cn } from "@/lib/cn";

const SAMPLE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const DEFAULT_OUTPUT_TEMPLATE = "%(title)s.%(ext)s";

const FORMAT_PRESETS = [
  { key: "recommended", value: "best" },
  { key: "best", value: "bestvideo+bestaudio/best" },
  { key: "small", value: "worst" },
  { key: "custom", value: "custom" },
] as const;

const AUDIO_FORMATS = ["mp3", "m4a", "opus", "wav"] as const;
const MERGE_FORMATS = [
  { key: "auto", value: "default" },
  { key: "mp4", value: "mp4" },
  { key: "mkv", value: "mkv" },
  { key: "webm", value: "webm" },
] as const;

type DownloadMode = "video" | "audio";
type FormatPreset = (typeof FORMAT_PRESETS)[number]["value"];
type AudioFormat = (typeof AUDIO_FORMATS)[number];
type MergeFormat = (typeof MERGE_FORMATS)[number]["value"];

const RECOMMENDED_SETTINGS = {
  mode: "video" as DownloadMode,
  formatPreset: "best" as FormatPreset,
  customFormat: "",
  audioFormat: "mp3" as AudioFormat,
  audioQuality: "",
  outputTemplate: DEFAULT_OUTPUT_TEMPLATE,
  outputPath: "",
  mergeFormat: "default" as MergeFormat,
  manualSubtitles: false,
  autoSubtitles: false,
  embedSubtitles: false,
  subtitleLangs: "en.*",
  embedThumbnail: false,
  writeThumbnail: false,
  noPlaylist: true,
  cookiesFile: "",
  downloadArchive: "",
  rateLimit: "",
  customArgs: "",
};

const shouldQuote = (value: string) => /[^A-Za-z0-9_./:=+-]/.test(value);

const shellQuote = (value: string) => {
  if (!value) return "''";
  if (!shouldQuote(value)) return value;
  return `'${value.replace(/'/g, `'"'"'`)}'`;
};

type ToggleButtonProps = {
  active: boolean;
  onClick: () => void;
  label: string;
};

function ToggleButton({ active, onClick, label }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border border-[color:var(--glass-border)] px-3 py-1 text-xs transition-colors",
        active
          ? "bg-[color:var(--accent-blue)] text-white"
          : "bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
      )}
    >
      {label}
    </button>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
      {children}
    </p>
  );
}

export default function YtDlpTool() {
  const t = useTranslations("tools.yt-dlp.ui");
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<DownloadMode>(RECOMMENDED_SETTINGS.mode);
  const [formatPreset, setFormatPreset] = useState<FormatPreset>(
    RECOMMENDED_SETTINGS.formatPreset
  );
  const [customFormat, setCustomFormat] = useState(
    RECOMMENDED_SETTINGS.customFormat
  );
  const [audioFormat, setAudioFormat] = useState<AudioFormat>(
    RECOMMENDED_SETTINGS.audioFormat
  );
  const [audioQuality, setAudioQuality] = useState(
    RECOMMENDED_SETTINGS.audioQuality
  );
  const [outputTemplate, setOutputTemplate] = useState(
    RECOMMENDED_SETTINGS.outputTemplate
  );
  const [outputPath, setOutputPath] = useState(RECOMMENDED_SETTINGS.outputPath);
  const [mergeFormat, setMergeFormat] = useState<MergeFormat>(
    RECOMMENDED_SETTINGS.mergeFormat
  );
  const [manualSubtitles, setManualSubtitles] = useState(
    RECOMMENDED_SETTINGS.manualSubtitles
  );
  const [autoSubtitles, setAutoSubtitles] = useState(
    RECOMMENDED_SETTINGS.autoSubtitles
  );
  const [embedSubtitles, setEmbedSubtitles] = useState(
    RECOMMENDED_SETTINGS.embedSubtitles
  );
  const [subtitleLangs, setSubtitleLangs] = useState(
    RECOMMENDED_SETTINGS.subtitleLangs
  );
  const [embedThumbnail, setEmbedThumbnail] = useState(
    RECOMMENDED_SETTINGS.embedThumbnail
  );
  const [writeThumbnail, setWriteThumbnail] = useState(
    RECOMMENDED_SETTINGS.writeThumbnail
  );
  const [noPlaylist, setNoPlaylist] = useState(RECOMMENDED_SETTINGS.noPlaylist);
  const [cookiesFile, setCookiesFile] = useState(
    RECOMMENDED_SETTINGS.cookiesFile
  );
  const [downloadArchive, setDownloadArchive] = useState(
    RECOMMENDED_SETTINGS.downloadArchive
  );
  const [rateLimit, setRateLimit] = useState(RECOMMENDED_SETTINGS.rateLimit);
  const [customArgs, setCustomArgs] = useState(RECOMMENDED_SETTINGS.customArgs);
  const [copied, setCopied] = useState(false);

  const resolvedFormat = useMemo(() => {
    if (formatPreset !== "custom") return formatPreset;
    return customFormat.trim() || "best";
  }, [customFormat, formatPreset]);

  const hasSubtitles = manualSubtitles || autoSubtitles;

  const isRecommended = useMemo(
    () =>
      mode === RECOMMENDED_SETTINGS.mode &&
      formatPreset === RECOMMENDED_SETTINGS.formatPreset &&
      customFormat === RECOMMENDED_SETTINGS.customFormat &&
      audioFormat === RECOMMENDED_SETTINGS.audioFormat &&
      audioQuality === RECOMMENDED_SETTINGS.audioQuality &&
      outputTemplate === RECOMMENDED_SETTINGS.outputTemplate &&
      outputPath === RECOMMENDED_SETTINGS.outputPath &&
      mergeFormat === RECOMMENDED_SETTINGS.mergeFormat &&
      manualSubtitles === RECOMMENDED_SETTINGS.manualSubtitles &&
      autoSubtitles === RECOMMENDED_SETTINGS.autoSubtitles &&
      embedSubtitles === RECOMMENDED_SETTINGS.embedSubtitles &&
      subtitleLangs === RECOMMENDED_SETTINGS.subtitleLangs &&
      embedThumbnail === RECOMMENDED_SETTINGS.embedThumbnail &&
      writeThumbnail === RECOMMENDED_SETTINGS.writeThumbnail &&
      noPlaylist === RECOMMENDED_SETTINGS.noPlaylist &&
      cookiesFile === RECOMMENDED_SETTINGS.cookiesFile &&
      downloadArchive === RECOMMENDED_SETTINGS.downloadArchive &&
      rateLimit === RECOMMENDED_SETTINGS.rateLimit &&
      customArgs === RECOMMENDED_SETTINGS.customArgs,
    [
      audioFormat,
      audioQuality,
      autoSubtitles,
      cookiesFile,
      customArgs,
      customFormat,
      downloadArchive,
      embedSubtitles,
      embedThumbnail,
      formatPreset,
      manualSubtitles,
      mergeFormat,
      mode,
      noPlaylist,
      outputPath,
      outputTemplate,
      rateLimit,
      subtitleLangs,
      writeThumbnail,
    ]
  );

  const formatNeedsMerge = mode === "video" && resolvedFormat.includes("+");
  const needsFfmpeg =
    formatNeedsMerge ||
    (mode === "video" && mergeFormat !== "default") ||
    embedSubtitles ||
    embedThumbnail;

  const command = useMemo(() => {
    const parts: string[] = ["yt-dlp"];
    const add = (value: string) => {
      parts.push(shellQuote(value));
    };
    const addFlag = (flag: string, value?: string) => {
      add(flag);
      if (value) add(value);
    };

    if (mode === "audio") {
      add("-x");
      addFlag("--audio-format", audioFormat);
      if (audioQuality.trim()) {
        addFlag("--audio-quality", audioQuality.trim());
      }
    } else {
      addFlag("--format", resolvedFormat);
      if (mergeFormat !== "default") {
        addFlag("--merge-output-format", mergeFormat);
      }
    }

    if (outputPath.trim()) {
      addFlag("-P", outputPath.trim());
    }
    if (noPlaylist) add("--no-playlist");
    if (manualSubtitles) add("--write-subs");
    if (autoSubtitles) add("--write-auto-subs");
    if (hasSubtitles && subtitleLangs.trim()) {
      addFlag("--sub-langs", subtitleLangs.trim());
    }
    if (embedSubtitles && hasSubtitles) add("--embed-subs");
    if (writeThumbnail) add("--write-thumbnail");
    if (embedThumbnail) add("--embed-thumbnail");
    if (cookiesFile.trim()) {
      addFlag("--cookies", cookiesFile.trim());
    }
    if (downloadArchive.trim()) {
      addFlag("--download-archive", downloadArchive.trim());
    }
    if (rateLimit.trim()) {
      addFlag("--limit-rate", rateLimit.trim());
    }
    if (outputTemplate.trim()) {
      addFlag("--output", outputTemplate.trim());
    }
    if (customArgs.trim()) {
      parts.push(customArgs.trim());
    }

    const target = url.trim() || "<URL>";
    parts.push(target === "<URL>" ? target : shellQuote(target));
    return parts.join(" ");
  }, [
    audioFormat,
    audioQuality,
    autoSubtitles,
    cookiesFile,
    customArgs,
    downloadArchive,
    embedSubtitles,
    embedThumbnail,
    hasSubtitles,
    manualSubtitles,
    mergeFormat,
    mode,
    noPlaylist,
    outputPath,
    outputTemplate,
    rateLimit,
    resolvedFormat,
    subtitleLangs,
    url,
    writeThumbnail,
  ]);

  const status = useMemo(() => {
    if (copied) return t("status.copied");
    if (!url.trim()) return t("status.needUrl");
    if (mode === "video" && formatPreset === "custom" && !customFormat.trim()) {
      return t("status.customFormatEmpty");
    }
    return t("status.ready");
  }, [copied, customFormat, formatPreset, mode, t, url]);

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  const applyRecommended = () => {
    setMode(RECOMMENDED_SETTINGS.mode);
    setFormatPreset(RECOMMENDED_SETTINGS.formatPreset);
    setCustomFormat(RECOMMENDED_SETTINGS.customFormat);
    setAudioFormat(RECOMMENDED_SETTINGS.audioFormat);
    setAudioQuality(RECOMMENDED_SETTINGS.audioQuality);
    setOutputTemplate(RECOMMENDED_SETTINGS.outputTemplate);
    setOutputPath(RECOMMENDED_SETTINGS.outputPath);
    setMergeFormat(RECOMMENDED_SETTINGS.mergeFormat);
    setManualSubtitles(RECOMMENDED_SETTINGS.manualSubtitles);
    setAutoSubtitles(RECOMMENDED_SETTINGS.autoSubtitles);
    setEmbedSubtitles(RECOMMENDED_SETTINGS.embedSubtitles);
    setSubtitleLangs(RECOMMENDED_SETTINGS.subtitleLangs);
    setEmbedThumbnail(RECOMMENDED_SETTINGS.embedThumbnail);
    setWriteThumbnail(RECOMMENDED_SETTINGS.writeThumbnail);
    setNoPlaylist(RECOMMENDED_SETTINGS.noPlaylist);
    setCookiesFile(RECOMMENDED_SETTINGS.cookiesFile);
    setDownloadArchive(RECOMMENDED_SETTINGS.downloadArchive);
    setRateLimit(RECOMMENDED_SETTINGS.rateLimit);
    setCustomArgs(RECOMMENDED_SETTINGS.customArgs);
    setCopied(false);
  };

  const resetAll = () => {
    setUrl("");
    applyRecommended();
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={mode === "video" ? "primary" : "secondary"}
            onClick={() => {
              setMode("video");
              setCopied(false);
            }}
            className="font-semibold"
          >
            {t("actions.video")}
          </Button>
          <Button
            variant={mode === "audio" ? "primary" : "secondary"}
            onClick={() => {
              setMode("audio");
              setCopied(false);
            }}
            className="font-semibold"
          >
            {t("actions.audio")}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SecondaryButton
            onClick={() => {
              setUrl(SAMPLE_URL);
              setCopied(false);
            }}
          >
            {t("actions.sampleUrl")}
          </SecondaryButton>
          <GhostButton onClick={resetAll}>{t("actions.reset")}</GhostButton>
        </div>
      </div>
      <p
        className={cn(
          "min-h-[1.25rem] text-xs",
          mode === "video" && formatPreset === "custom" && !customFormat.trim()
            ? "text-amber-500/80"
            : "text-[color:var(--text-secondary)]"
        )}
        aria-live="polite"
      >
        {status}
      </p>
      <div className="flex flex-col gap-4">
        <section className="rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
          <div className="flex items-center justify-between">
            <SectionLabel>{t("labels.sourceUrl")}</SectionLabel>
            <span className="text-[11px] text-[color:var(--text-secondary)]">
              {t("labels.supports")}
            </span>
          </div>
          <input
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setCopied(false);
            }}
            placeholder={t("placeholders.url")}
            spellCheck={false}
            className="mt-3 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
          />
        </section>
        <section className="rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
          <div className="flex items-center justify-between">
            <SectionLabel>{t("labels.profile")}</SectionLabel>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[color:var(--text-secondary)]">
                {isRecommended ? t("labels.profileRecommended") : t("labels.profileCustom")}
              </span>
              {!isRecommended ? (
                <SecondaryButton size="sm" onClick={applyRecommended}>
                  {t("actions.applyRecommended")}
                </SecondaryButton>
              ) : null}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ToggleButton
              active={mode === "video"}
              onClick={() => {
                setMode("video");
                setCopied(false);
              }}
              label={t("actions.video")}
            />
            <ToggleButton
              active={mode === "audio"}
              onClick={() => {
                setMode("audio");
                setCopied(false);
              }}
              label={t("actions.audio")}
            />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              {mode === "video" ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <SectionLabel>{t("labels.format")}</SectionLabel>
                    <Select
                      value={formatPreset}
                      onChange={(event) => {
                        setFormatPreset(event.target.value as FormatPreset);
                        setCopied(false);
                      }}
                      className="mt-2"
                      buttonClassName="border-transparent"
                    >
                      {FORMAT_PRESETS.map((preset) => (
                        <option key={preset.value} value={preset.value}>
                          {t(`formatPresets.${preset.key}`)}
                        </option>
                      ))}
                    </Select>
                    {formatPreset === "custom" ? (
                      <div className="mt-2">
                        <input
                          value={customFormat}
                          onChange={(event) => {
                            setCustomFormat(event.target.value);
                            setCopied(false);
                          }}
                          placeholder="bv*+ba/b"
                          spellCheck={false}
                          className="w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                        />
                        <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
                          {t("hints.customFormat")}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <SectionLabel>{t("labels.mergeFormat")}</SectionLabel>
                    <Select
                      value={mergeFormat}
                      onChange={(event) => {
                        setMergeFormat(event.target.value as MergeFormat);
                        setCopied(false);
                      }}
                      className="mt-2"
                      buttonClassName="border-transparent"
                    >
                      {MERGE_FORMATS.map((preset) => (
                        <option key={preset.value} value={preset.value}>
                          {t(`mergeFormats.${preset.key}`)}
                        </option>
                      ))}
                    </Select>
                    <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
                      {t("hints.mergeFormat")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div>
                    <SectionLabel>{t("labels.audioFormat")}</SectionLabel>
                    <Select
                      value={audioFormat}
                      onChange={(event) => {
                        setAudioFormat(event.target.value as AudioFormat);
                        setCopied(false);
                      }}
                      className="mt-2"
                      buttonClassName="border-transparent"
                    >
                      {AUDIO_FORMATS.map((format) => (
                        <option key={format} value={format}>
                          {format}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <SectionLabel>{t("labels.audioQuality")}</SectionLabel>
                    <input
                      value={audioQuality}
                      onChange={(event) => {
                        setAudioQuality(event.target.value);
                        setCopied(false);
                      }}
                      spellCheck={false}
                      placeholder={t("placeholders.audioQuality")}
                      className="mt-2 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                    />
                    <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
                      {t("hints.audioQuality")}
                    </p>
                  </div>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <SectionLabel>{t("labels.outputTemplate")}</SectionLabel>
                  <input
                    value={outputTemplate}
                    onChange={(event) => {
                      setOutputTemplate(event.target.value);
                      setCopied(false);
                    }}
                    spellCheck={false}
                    placeholder={DEFAULT_OUTPUT_TEMPLATE}
                    className="mt-2 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                  />
                </div>
                <div>
                  <SectionLabel>{t("labels.outputFolder")}</SectionLabel>
                  <input
                    value={outputPath}
                    onChange={(event) => {
                      setOutputPath(event.target.value);
                      setCopied(false);
                    }}
                    spellCheck={false}
                    placeholder={t("placeholders.outputFolder")}
                    className="mt-2 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                  />
                  <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
                    {t("hints.outputFolder")}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <SectionLabel>{t("labels.playlist")}</SectionLabel>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ToggleButton
                      active={noPlaylist}
                      onClick={() => {
                        setNoPlaylist((prev) => !prev);
                        setCopied(false);
                      }}
                      label={t("actions.noPlaylist")}
                    />
                  </div>
                </div>
                <div>
                  <SectionLabel>{t("labels.rateLimit")}</SectionLabel>
                  <input
                    value={rateLimit}
                    onChange={(event) => {
                      setRateLimit(event.target.value);
                      setCopied(false);
                    }}
                    spellCheck={false}
                    placeholder={t("placeholders.rateLimit")}
                    className="mt-2 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                  />
                  <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
                    {t("hints.rateLimit")}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <SectionLabel>{t("labels.subtitles")}</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  <ToggleButton
                    active={manualSubtitles}
                    onClick={() => {
                      setManualSubtitles((prev) => {
                        const next = !prev;
                        if (!next && !autoSubtitles) {
                          setEmbedSubtitles(false);
                        }
                        return next;
                      });
                      setCopied(false);
                    }}
                    label={t("actions.subtitlesManual")}
                  />
                  <ToggleButton
                    active={autoSubtitles}
                    onClick={() => {
                      setAutoSubtitles((prev) => {
                        const next = !prev;
                        if (!next && !manualSubtitles) {
                          setEmbedSubtitles(false);
                        }
                        return next;
                      });
                      setCopied(false);
                    }}
                    label={t("actions.subtitlesAuto")}
                  />
                  {hasSubtitles ? (
                    <ToggleButton
                      active={embedSubtitles}
                      onClick={() => {
                        setEmbedSubtitles((prev) => !prev);
                        setCopied(false);
                      }}
                      label={t("actions.subtitlesEmbed")}
                    />
                  ) : null}
                </div>
                {hasSubtitles ? (
                  <div>
                    <SectionLabel>{t("labels.subtitleLangs")}</SectionLabel>
                    <input
                      value={subtitleLangs}
                      onChange={(event) => {
                        setSubtitleLangs(event.target.value);
                        setCopied(false);
                      }}
                      spellCheck={false}
                      placeholder={t("placeholders.subtitleLangs")}
                      className="mt-2 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-3">
                <SectionLabel>{t("labels.thumbnails")}</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  <ToggleButton
                    active={embedThumbnail}
                    onClick={() => {
                      setEmbedThumbnail((prev) => !prev);
                      setCopied(false);
                    }}
                    label={t("actions.thumbnailsEmbed")}
                  />
                  <ToggleButton
                    active={writeThumbnail}
                    onClick={() => {
                      setWriteThumbnail((prev) => !prev);
                      setCopied(false);
                    }}
                    label={t("actions.thumbnailsSave")}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <SectionLabel>{t("labels.cookiesFile")}</SectionLabel>
                  <input
                    value={cookiesFile}
                    onChange={(event) => {
                      setCookiesFile(event.target.value);
                      setCopied(false);
                    }}
                    spellCheck={false}
                    placeholder={t("placeholders.cookiesFile")}
                    className="mt-2 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                  />
                  <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
                    {t("hints.cookiesFile")}
                  </p>
                </div>
                <div>
                  <SectionLabel>{t("labels.downloadArchive")}</SectionLabel>
                  <input
                    value={downloadArchive}
                    onChange={(event) => {
                      setDownloadArchive(event.target.value);
                      setCopied(false);
                    }}
                    spellCheck={false}
                    placeholder={t("placeholders.downloadArchive")}
                    className="mt-2 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                  />
                  <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
                    {t("hints.downloadArchive")}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <SectionLabel>{t("labels.extraArgs")}</SectionLabel>
                <input
                  value={customArgs}
                  onChange={(event) => {
                    setCustomArgs(event.target.value);
                    setCopied(false);
                  }}
                  spellCheck={false}
                  placeholder={t("placeholders.extraArgs")}
                  className="mt-2 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                />
                <p className="text-[11px] text-[color:var(--text-secondary)]">
                  {t("hints.extraArgs")}
                </p>
              </div>
            </div>
          </div>
        </section>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <section className="flex min-h-[220px] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
            <div className="flex items-center justify-between">
              <SectionLabel>{t("labels.command")}</SectionLabel>
              <SecondaryButton size="sm" onClick={copyCommand}>
                {t("actions.copy")}
              </SecondaryButton>
            </div>
            <textarea
              value={command}
              readOnly
              spellCheck={false}
              className="mt-3 min-h-[160px] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
            />
            <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
              {t("hints.command")}
            </p>
          </section>
          <section className="rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
            <SectionLabel>{t("labels.quickStart")}</SectionLabel>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
              {t("hints.quickStart")}
            </p>
            <div className="mt-3 flex flex-col gap-2 text-xs">
              <div className="rounded-[12px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-3 py-2 font-mono text-[color:var(--text-primary)]">
                brew install yt-dlp
              </div>
              <div className="rounded-[12px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-3 py-2 font-mono text-[color:var(--text-primary)]">
                python -m pip install -U yt-dlp
              </div>
              <div className="rounded-[12px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-3 py-2 font-mono text-[color:var(--text-primary)]">
                yt-dlp --update
              </div>
            </div>
            {needsFfmpeg ? (
              <p className="mt-3 text-xs text-[color:var(--text-secondary)]">
                {t("hints.ffmpeg")}
              </p>
            ) : null}
            <a
              href="https://github.com/yt-dlp/yt-dlp"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex text-xs font-semibold text-[color:var(--accent-blue)]"
            >
              {t("actions.viewRepo")}
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}
