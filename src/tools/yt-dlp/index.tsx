"use client";

import { useMemo, useState } from "react";

import { Button, GhostButton, SecondaryButton } from "@/components/Button";
import { Select } from "@/components/Select";
import { cn } from "@/lib/cn";

const SAMPLE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const DEFAULT_OUTPUT_TEMPLATE = "%(title)s.%(ext)s";

const FORMAT_PRESETS = [
  { label: "Recommended (single file)", value: "best" },
  { label: "Best video + audio (ffmpeg)", value: "bestvideo+bestaudio/best" },
  { label: "Small (worst)", value: "worst" },
  { label: "Custom", value: "custom" },
] as const;

const AUDIO_FORMATS = ["mp3", "m4a", "opus", "wav"] as const;
const MERGE_FORMATS = [
  { label: "Auto (default)", value: "default" },
  { label: "MP4", value: "mp4" },
  { label: "MKV", value: "mkv" },
  { label: "WebM", value: "webm" },
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
    if (copied) return "Copied to clipboard.";
    if (!url.trim()) return "Paste a URL to build the command.";
    if (mode === "video" && formatPreset === "custom" && !customFormat.trim()) {
      return "Custom format is empty; falling back to best.";
    }
    return "Command ready.";
  }, [copied, customFormat, formatPreset, mode, url]);

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
            Video
          </Button>
          <Button
            variant={mode === "audio" ? "primary" : "secondary"}
            onClick={() => {
              setMode("audio");
              setCopied(false);
            }}
            className="font-semibold"
          >
            Audio
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SecondaryButton
            onClick={() => {
              setUrl(SAMPLE_URL);
              setCopied(false);
            }}
          >
            Sample URL
          </SecondaryButton>
          <GhostButton onClick={resetAll}>Reset</GhostButton>
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
            <SectionLabel>Source URL</SectionLabel>
            <span className="text-[11px] text-[color:var(--text-secondary)]">
              Supports playlists and channels.
            </span>
          </div>
          <input
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setCopied(false);
            }}
            placeholder="https://..."
            spellCheck={false}
            className="mt-3 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
          />
        </section>
        <section className="rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
          <div className="flex items-center justify-between">
            <SectionLabel>Download Profile</SectionLabel>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[color:var(--text-secondary)]">
                {isRecommended ? "Recommended (default)" : "Custom"}
              </span>
              {!isRecommended ? (
                <SecondaryButton size="sm" onClick={applyRecommended}>
                  Use recommended
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
              label="Video"
            />
            <ToggleButton
              active={mode === "audio"}
              onClick={() => {
                setMode("audio");
                setCopied(false);
              }}
              label="Audio"
            />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              {mode === "video" ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <SectionLabel>Format</SectionLabel>
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
                          {preset.label}
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
                          Leave blank to fall back to best.
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <SectionLabel>Merge format</SectionLabel>
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
                          {preset.label}
                        </option>
                      ))}
                    </Select>
                    <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
                      Use MP4 for broad compatibility.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div>
                    <SectionLabel>Audio format</SectionLabel>
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
                    <SectionLabel>Audio quality</SectionLabel>
                    <input
                      value={audioQuality}
                      onChange={(event) => {
                        setAudioQuality(event.target.value);
                        setCopied(false);
                      }}
                      spellCheck={false}
                      placeholder="0 (best) or 192K"
                      className="mt-2 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                    />
                    <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
                      Optional quality hint for audio extraction.
                    </p>
                  </div>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <SectionLabel>Output template</SectionLabel>
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
                  <SectionLabel>Output folder</SectionLabel>
                  <input
                    value={outputPath}
                    onChange={(event) => {
                      setOutputPath(event.target.value);
                      setCopied(false);
                    }}
                    spellCheck={false}
                    placeholder="./downloads"
                    className="mt-2 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                  />
                  <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
                    Optional base folder for downloads.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <SectionLabel>Playlist</SectionLabel>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ToggleButton
                      active={noPlaylist}
                      onClick={() => {
                        setNoPlaylist((prev) => !prev);
                        setCopied(false);
                      }}
                      label="No playlist"
                    />
                  </div>
                </div>
                <div>
                  <SectionLabel>Rate limit</SectionLabel>
                  <input
                    value={rateLimit}
                    onChange={(event) => {
                      setRateLimit(event.target.value);
                      setCopied(false);
                    }}
                    spellCheck={false}
                    placeholder="1M, 500K"
                    className="mt-2 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                  />
                  <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
                    Optional bandwidth throttle.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <SectionLabel>Subtitles</SectionLabel>
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
                    label="Manual"
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
                    label="Auto"
                  />
                  {hasSubtitles ? (
                    <ToggleButton
                      active={embedSubtitles}
                      onClick={() => {
                        setEmbedSubtitles((prev) => !prev);
                        setCopied(false);
                      }}
                      label="Embed"
                    />
                  ) : null}
                </div>
                {hasSubtitles ? (
                  <div>
                    <SectionLabel>Subtitle langs</SectionLabel>
                    <input
                      value={subtitleLangs}
                      onChange={(event) => {
                        setSubtitleLangs(event.target.value);
                        setCopied(false);
                      }}
                      spellCheck={false}
                      placeholder="en.*,zh.*,ja"
                      className="mt-2 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-3">
                <SectionLabel>Thumbnails</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  <ToggleButton
                    active={embedThumbnail}
                    onClick={() => {
                      setEmbedThumbnail((prev) => !prev);
                      setCopied(false);
                    }}
                    label="Embed"
                  />
                  <ToggleButton
                    active={writeThumbnail}
                    onClick={() => {
                      setWriteThumbnail((prev) => !prev);
                      setCopied(false);
                    }}
                    label="Save file"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <SectionLabel>Cookies file</SectionLabel>
                  <input
                    value={cookiesFile}
                    onChange={(event) => {
                      setCookiesFile(event.target.value);
                      setCopied(false);
                    }}
                    spellCheck={false}
                    placeholder="cookies.txt"
                    className="mt-2 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                  />
                  <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
                    Use for age-gated or private content.
                  </p>
                </div>
                <div>
                  <SectionLabel>Download archive</SectionLabel>
                  <input
                    value={downloadArchive}
                    onChange={(event) => {
                      setDownloadArchive(event.target.value);
                      setCopied(false);
                    }}
                    spellCheck={false}
                    placeholder="archive.txt"
                    className="mt-2 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                  />
                  <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
                    Skip URLs already recorded in this file.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <SectionLabel>Extra args</SectionLabel>
                <input
                  value={customArgs}
                  onChange={(event) => {
                    setCustomArgs(event.target.value);
                    setCopied(false);
                  }}
                  spellCheck={false}
                  placeholder="--cookies cookies.txt --remux-video mp4"
                  className="mt-2 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                />
                <p className="text-[11px] text-[color:var(--text-secondary)]">
                  Extra args are appended verbatim before the URL.
                </p>
              </div>
            </div>
          </div>
        </section>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <section className="flex min-h-[220px] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
            <div className="flex items-center justify-between">
              <SectionLabel>Command</SectionLabel>
              <SecondaryButton size="sm" onClick={copyCommand}>
                Copy
              </SecondaryButton>
            </div>
            <textarea
              value={command}
              readOnly
              spellCheck={false}
              className="mt-3 min-h-[160px] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
            />
            <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
              Edit flags to match your target quality and output layout.
            </p>
          </section>
          <section className="rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
            <SectionLabel>Quick start</SectionLabel>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
              Install yt-dlp locally, then run the command above.
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
                FFmpeg is required for merge or embed options.
              </p>
            ) : null}
            <a
              href="https://github.com/yt-dlp/yt-dlp"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex text-xs font-semibold text-[color:var(--accent-blue)]"
            >
              View GitHub repo
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}
