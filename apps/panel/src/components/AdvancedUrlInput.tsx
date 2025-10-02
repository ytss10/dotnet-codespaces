import React, { useState, useCallback, useRef, useMemo } from "react";
import type { ChangeEvent, DragEvent } from "react";

export interface BulkEmbedOptions {
  batchSize: number;
  parallelProcessing: boolean;
  fallbackStrategy: "synthesize" | "reject" | "loopback";
  enableGlobalProxies: boolean;
  preferredRegions: string[];
  preferredCountries: string[];
  renderEngine: "hypermedia-virtual" | "chromium-headless" | "webgpu";
  viewport: { width: number; height: number };
}

const COUNTRY_OPTIONS: Array<{ code: string; name: string; flag: string }> = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "JP", name: "Japan", flag: "🇯🇵" }
];

interface AdvancedUrlInputProps {
  onBulkEmbed: (urls: string[], options: BulkEmbedOptions) => Promise<void>;
  onScaleToMillion: (targetSessions: number) => Promise<void>;
  orchestratorUrl: string;
  busy?: boolean;
}

const defaultOptions: BulkEmbedOptions = {
  batchSize: 100,
  parallelProcessing: true,
  fallbackStrategy: "synthesize",
  enableGlobalProxies: true,
  preferredRegions: [],
  preferredCountries: [],
  renderEngine: "hypermedia-virtual",
  viewport: { width: 1280, height: 720 }
};

export function AdvancedUrlInput({
  onBulkEmbed,
  onScaleToMillion,
  orchestratorUrl,
  busy = false
}: AdvancedUrlInputProps) {
  const [urls, setUrls] = useState<string>("");
  const [options, setOptions] = useState<BulkEmbedOptions>(defaultOptions);
  const [targetSessions, setTargetSessions] = useState<number>(1000000);
  const [processing, setProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [countryFilter, setCountryFilter] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filteredCountryOptions = useMemo(() => {
    const query = countryFilter.trim().toLowerCase();
    if (!query) {
      return COUNTRY_OPTIONS;
    }
    return COUNTRY_OPTIONS.filter(option =>
      option.name.toLowerCase().includes(query) || option.code.toLowerCase().includes(query)
    );
  }, [countryFilter]);
  const selectedCountryDetails = useMemo(() => {
    return options.preferredCountries
      .map(code => COUNTRY_OPTIONS.find(option => option.code === code))
      .filter((option): option is typeof COUNTRY_OPTIONS[number] => Boolean(option));
  }, [options.preferredCountries]);

  const parseUrls = useCallback((text: string): string[] => {
    return text
      .split(/[\\n\\r,;\\s]+/)
      .map(url => url.trim())
      .filter(url => url.length > 0);
  }, []);

  const handleUrlChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setUrls(event.target.value);
  }, []);

  const handleBulkSubmit = useCallback(async () => {
    const urlList = parseUrls(urls);
    if (!urlList.length) {
      alert("Please enter at least one URL");
      return;
    }

    if (urlList.length > 1000000) {
      alert("Maximum 1,000,000 URLs supported in a single batch");
      return;
    }

    setProcessing(true);
    try {
      await onBulkEmbed(urlList, options);
      setUrls("");
    } catch (error) {
      console.error("Bulk embed failed:", error);
      alert(`Bulk embed failed: ${(error as Error).message}`);
    } finally {
      setProcessing(false);
    }
  }, [urls, options, onBulkEmbed, parseUrls]);

  const handleScaleSubmit = useCallback(async () => {
    if (targetSessions < 1 || targetSessions > 10000000) {
      alert("Target sessions must be between 1 and 10,000,000");
      return;
    }

    setProcessing(true);
    try {
      await onScaleToMillion(targetSessions);
    } catch (error) {
      console.error("Scale operation failed:", error);
      alert(`Scale operation failed: ${(error as Error).message}`);
    } finally {
      setProcessing(false);
    }
  }, [targetSessions, onScaleToMillion]);

  const handleFileDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);

    const files = Array.from(event.dataTransfer.files);
    const textFile = files.find(file => file.type === "text/plain" || file.name.endsWith(".txt"));
    
    if (textFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          setUrls(prev => prev ? `${prev}\\n${content}` : content);
        }
      };
      reader.readAsText(textFile);
    }
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const handleFileSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          setUrls(content);
        }
      };
      reader.readAsText(file);
    }
  }, []);

  const handleAddSyntheticPresets = useCallback(() => {
    const presets = Array.from({ length: 10 }).map((_, index) => {
      const shard = (index + 1).toString().padStart(4, "0");
      return `https://synthetic.mega.local/constellation/${shard}`;
    });
    setUrls(prev => (prev ? `${prev}\n${presets.join("\n")}` : presets.join("\n")));
  }, []);

  const handleCountryToggle = useCallback((code: string) => {
    setOptions(prev => {
      const exists = prev.preferredCountries.includes(code);
      const nextCountries = exists
        ? prev.preferredCountries.filter(item => item !== code)
        : [...prev.preferredCountries, code];
      return { ...prev, preferredCountries: nextCountries };
    });
  }, []);

  const handleClearCountries = useCallback(() => {
    setOptions(prev => ({ ...prev, preferredCountries: [] }));
  }, []);

  const urlCount = parseUrls(urls).length;

  return (
    <div className="advanced-url-input">
      <div className="advanced-url-input__header">
        <h2>Advanced Bulk Website Embedding</h2>
        <p>Embed up to 1,000,000 websites simultaneously with intelligent proxy rotation and global scaling</p>
      </div>

      <div 
        className={`advanced-url-input__drop-zone ${dragActive ? "advanced-url-input__drop-zone--active" : ""}`}
        onDrop={handleFileDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <textarea
          value={urls}
          onChange={handleUrlChange}
          placeholder="Enter URLs (one per line) or drag & drop a text file&#10;&#10;Examples:&#10;https://synthetic.mega.local/galaxy/alpha&#10;https://synthetic.mega.local/atlas/42&#10;origin.example (protocol will be inferred)&#10;blank lines will synthesize deterministic sandbox sessions"
          rows={10}
          className="advanced-url-input__textarea"
          disabled={processing || busy}
        />
        
        {dragActive && (
          <div className="advanced-url-input__drop-overlay">
            <div className="advanced-url-input__drop-message">
              Drop text file here to add URLs
            </div>
          </div>
        )}
      </div>

      <div className="advanced-url-input__actions">
        <div className="advanced-url-input__quick-actions">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="advanced-url-input__button advanced-url-input__button--secondary"
            disabled={processing || busy}
          >
            📁 Load from File
          </button>
          
          <button
            type="button"
            onClick={handleAddSyntheticPresets}
            className="advanced-url-input__button advanced-url-input__button--secondary"
            disabled={processing || busy}
          >
            🧬 Inject Synthetic Presets
          </button>

          <button
            type="button"
            onClick={() => setUrls("")}
            className="advanced-url-input__button advanced-url-input__button--danger"
            disabled={processing || busy || !urls.trim()}
          >
            🗑️ Clear All
          </button>
        </div>

        <div className="advanced-url-input__status">
          <span className="advanced-url-input__count">
            {urlCount.toLocaleString()} URLs ready
          </span>
        </div>
      </div>

      <div className="advanced-url-input__options">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="advanced-url-input__toggle"
        >
          ⚙️ Advanced Options {showAdvanced ? "▼" : "▶"}
        </button>

        {showAdvanced && (
          <div className="advanced-url-input__advanced">
            <div className="advanced-url-input__option-group">
              <label className="advanced-url-input__label">
                <span>Batch Size:</span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={options.batchSize}
                  onChange={(e) => setOptions(prev => ({ ...prev, batchSize: parseInt(e.target.value) }))}
                  className="advanced-url-input__number"
                />
              </label>

              <label className="advanced-url-input__label">
                <span>Render Engine:</span>
                <select
                  value={options.renderEngine}
                  onChange={(e) => setOptions(prev => ({ ...prev, renderEngine: e.target.value as any }))}
                  className="advanced-url-input__select"
                >
                  <option value="hypermedia-virtual">Hypermedia Virtual (Fastest)</option>
                  <option value="chromium-headless">Chromium Headless (Standard)</option>
                  <option value="webgpu">WebGPU Accelerated (Premium)</option>
                </select>
              </label>
            </div>

            <div className="advanced-url-input__option-group">
              <label className="advanced-url-input__label">
                <input
                  type="checkbox"
                  checked={options.parallelProcessing}
                  onChange={(e) => setOptions(prev => ({ ...prev, parallelProcessing: e.target.checked }))}
                />
                <span>Parallel Processing</span>
              </label>

              <label className="advanced-url-input__label">
                <span>Fallback Strategy:</span>
                <select
                  value={options.fallbackStrategy}
                  onChange={(e) => setOptions(prev => ({ ...prev, fallbackStrategy: e.target.value as BulkEmbedOptions["fallbackStrategy"] }))}
                  className="advanced-url-input__select"
                >
                  <option value="synthesize">Synthesize deterministic microsites</option>
                  <option value="loopback">Loopback through synthetic portal</option>
                  <option value="reject">Reject invalid entries</option>
                </select>
              </label>

              <label className="advanced-url-input__label">
                <input
                  type="checkbox"
                  checked={options.enableGlobalProxies}
                  onChange={(e) => setOptions(prev => ({ ...prev, enableGlobalProxies: e.target.checked }))}
                />
                <span>Enable Global Proxy Rotation</span>
              </label>
            </div>

            <div className="advanced-url-input__option-group advanced-url-input__option-group--stacked">
              <label className="advanced-url-input__label advanced-url-input__label--stacked">
                <span>Preferred Proxy Countries</span>
                <div className="advanced-url-input__country-actions">
                  <input
                    type="text"
                    placeholder="Search country code or name"
                    value={countryFilter}
                    onChange={(event) => setCountryFilter(event.target.value)}
                    className="advanced-url-input__input"
                  />
                  <button
                    type="button"
                    className="advanced-url-input__button advanced-url-input__button--xsmall"
                    onClick={handleClearCountries}
                    disabled={!options.preferredCountries.length}
                  >
                    Clear
                  </button>
                </div>
              </label>
              <div className="advanced-url-input__country-grid">
                {filteredCountryOptions.map(option => {
                  const isSelected = options.preferredCountries.includes(option.code);
                  return (
                    <label
                      key={option.code}
                      className={`advanced-url-input__country-option ${isSelected ? "advanced-url-input__country-option--active" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleCountryToggle(option.code)}
                      />
                      <span className="advanced-url-input__country-flag">{option.flag}</span>
                      <span className="advanced-url-input__country-name">{option.name}</span>
                      <span className="advanced-url-input__country-code">{option.code}</span>
                    </label>
                  );
                })}
              </div>
              {selectedCountryDetails.length > 0 && (
                <div className="advanced-url-input__selected-countries">
                  {selectedCountryDetails.map(option => (
                    <button
                      type="button"
                      key={option.code}
                      className="advanced-url-input__chip"
                      onClick={() => handleCountryToggle(option.code)}
                    >
                      <span className="advanced-url-input__chip-flag">{option.flag}</span>
                      <span className="advanced-url-input__chip-label">{option.name}</span>
                      <span className="advanced-url-input__chip-close">×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="advanced-url-input__option-group">
              <label className="advanced-url-input__label">
                <span>Viewport:</span>
                <div className="advanced-url-input__viewport">
                  <input
                    type="number"
                    min={320}
                    max={4096}
                    value={options.viewport.width}
                    onChange={(e) => setOptions(prev => ({ 
                      ...prev, 
                      viewport: { ...prev.viewport, width: parseInt(e.target.value) }
                    }))}
                    className="advanced-url-input__number"
                  />
                  <span>×</span>
                  <input
                    type="number"
                    min={240}
                    max={4096}
                    value={options.viewport.height}
                    onChange={(e) => setOptions(prev => ({ 
                      ...prev, 
                      viewport: { ...prev.viewport, height: parseInt(e.target.value) }
                    }))}
                    className="advanced-url-input__number"
                  />
                </div>
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="advanced-url-input__submit">
        <button
          type="button"
          onClick={handleBulkSubmit}
          disabled={processing || busy || !urlCount}
          className="advanced-url-input__button advanced-url-input__button--primary"
        >
          {processing ? "Processing..." : `🚀 Embed ${urlCount.toLocaleString()} Websites`}
        </button>
      </div>

      <div className="advanced-url-input__scaling">
        <h3>Million-Scale Testing</h3>
        <div className="advanced-url-input__scale-controls">
          <label className="advanced-url-input__label">
            <span>Target Sessions:</span>
            <input
              type="number"
              min={1}
              max={10000000}
              value={targetSessions}
              onChange={(e) => setTargetSessions(parseInt(e.target.value))}
              className="advanced-url-input__number"
            />
          </label>
          
          <button
            type="button"
            onClick={handleScaleSubmit}
            disabled={processing || busy}
            className="advanced-url-input__button advanced-url-input__button--scale"
          >
            {processing ? "Scaling..." : `⚡ Scale to ${targetSessions.toLocaleString()} Sessions`}
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,text/plain"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
    </div>
  );
}