/**
 * Runtime state controller for the shader-transition loading overlay.
 *
 * Manages show/hide transitions (with a CSS fade-out delay) and updates
 * the progress bar, phrase text, and detail rows from `ShaderTransitionState`
 * messages received from the iframe.
 *
 * Holds direct references to the DOM nodes created by `createShaderLoader`
 * so state updates never touch the shadow-DOM query API at runtime.
 */

import i18n from "@/i18n";
import type { ShaderTransitionState } from "./shader-options.js";
import type { ShaderLoaderElements } from "./shader-loader-element.js";

const HIDE_TRANSITION_MS = 420;
const SHADER_LOADING_KEYS = [
  "preparing",
  "samplingOutgoing",
  "samplingIncoming",
  "cachingFrames",
  "finalizingPreview",
] as const;

export class ShaderLoaderState {
  private readonly _el: ShaderLoaderElements;
  private _hideTimeout: ReturnType<typeof setTimeout> | null = null;
  private _lastStatus: ShaderTransitionState | null = null;
  private _lastLoadingMode = "player";

  constructor(elements: ShaderLoaderElements) {
    this._el = elements;
    i18n.on("languageChanged", this._handleLanguageChanged);
  }

  show(): void {
    if (this._hideTimeout) {
      clearTimeout(this._hideTimeout);
      this._hideTimeout = null;
    }
    this._el.root.classList.remove("hfp-hiding");
    this._el.root.classList.add("hfp-visible");
  }

  hide(): void {
    if (this._el.root.classList.contains("hfp-hiding")) {
      if (!this._hideTimeout) this._scheduleCleanup();
      return;
    }
    if (!this._el.root.classList.contains("hfp-visible")) return;
    this._el.root.classList.add("hfp-hiding");
    this._el.root.classList.remove("hfp-visible");
    this._scheduleCleanup();
  }

  reset(): void {
    if (this._hideTimeout) {
      clearTimeout(this._hideTimeout);
      this._hideTimeout = null;
    }
    this._el.root.classList.remove("hfp-visible", "hfp-hiding");
    this._el.fill.style.transform = "scaleX(0)";
    this._el.transitionValue.textContent = "";
    this._el.frameValue.textContent = "";
    this._el.frameRow.style.visibility = "hidden";
  }

  update(status: ShaderTransitionState, loadingMode: string): void {
    this._lastStatus = status;
    this._lastLoadingMode = loadingMode;
    if (loadingMode !== "player") {
      this.reset();
      return;
    }
    if (status.ready || !status.loading) {
      this.hide();
      return;
    }

    const progress =
      typeof status.progress === "number" && Number.isFinite(status.progress) ? status.progress : 0;
    const total =
      typeof status.total === "number" && Number.isFinite(status.total) ? status.total : 0;
    const ratio = total > 0 ? Math.min(1, Math.max(0, progress / total)) : 0;

    const phraseIndex = Math.min(
      SHADER_LOADING_KEYS.length - 1,
      Math.floor(ratio * SHADER_LOADING_KEYS.length),
    );
    this._el.title.textContent = i18n.t(
      `hyperframes.player.shader.${SHADER_LOADING_KEYS[phraseIndex] ?? "preparing"}`,
    );

    this._el.detail.textContent =
      status.phase === "cached"
        ? i18n.t("hyperframes.player.shader.cachedDetail")
        : status.phase === "finalizing"
          ? i18n.t("hyperframes.player.shader.finalizingDetail")
          : i18n.t("hyperframes.player.shader.renderingDetail");

    this._el.fill.style.transform = `scaleX(${ratio})`;

    this._el.transitionValue.textContent =
      status.currentTransition !== undefined && status.transitionTotal !== undefined
        ? `${status.currentTransition}/${status.transitionTotal}`
        : total > 0
          ? `${progress}/${total}`
          : "";

    const frameValue =
      status.transitionFrame !== undefined && status.transitionFrames !== undefined
        ? `${status.transitionFrame}/${status.transitionFrames}`
        : "";

    this._el.frameLabel.textContent =
      status.phase === "cached"
        ? i18n.t("hyperframes.player.shader.cachedTransitionFrames")
        : status.phase === "finalizing"
          ? i18n.t("hyperframes.player.shader.finalizingTransitionFrames")
          : i18n.t("hyperframes.player.shader.renderingTransitionFrames");

    this._el.frameValue.textContent = frameValue;
    this._el.frameRow.style.visibility = frameValue ? "visible" : "hidden";
    this._el.root.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
    this.show();
  }

  get hideTimeout(): ReturnType<typeof setTimeout> | null {
    return this._hideTimeout;
  }

  destroy(): void {
    i18n.off("languageChanged", this._handleLanguageChanged);
    if (this._hideTimeout) {
      clearTimeout(this._hideTimeout);
      this._hideTimeout = null;
    }
  }

  private _handleLanguageChanged = (): void => {
    this._el.root.setAttribute("aria-label", i18n.t("hyperframes.player.shader.preparing"));
    this._el.transitionLabel.textContent = i18n.t("hyperframes.player.shader.transition");
    this._el.frameLabel.textContent = i18n.t("hyperframes.player.shader.transitionFrame");
    if (this._lastStatus) {
      this.update(this._lastStatus, this._lastLoadingMode);
      return;
    }
    this._el.title.textContent = i18n.t("hyperframes.player.shader.preparing");
    this._el.detail.textContent = i18n.t("hyperframes.player.shader.renderingDetail");
  };

  private _scheduleCleanup(): void {
    if (this._hideTimeout) clearTimeout(this._hideTimeout);
    this._hideTimeout = setTimeout(() => {
      this._el.root.classList.remove("hfp-hiding");
      this._hideTimeout = null;
    }, HIDE_TRANSITION_MS);
  }
}
