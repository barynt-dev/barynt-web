"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";
import { Lightbox } from "@/components/ui/layout/Lightbox/Lightbox";
import { usePluginText } from "../shared";
import styles from "./pluginStore.module.scss";

/**
 * A plugin's screenshots (BARY-199): one large, the others as thumbnails
 * below to pick from, arrows to step through. On a phone the thumbnails
 * are a row that scrolls sideways. A click on the large one shows them over
 * the whole screen (BARY-236), on the same image.
 */
export function PreviewGallery({
  previews,
}: {
  previews: { title: string; src: string }[];
}) {
  const text = usePluginText();
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState(false);
  if (previews.length === 0)
    return (
      <div className={styles.noPreviews}>
        <Icon icon="lucide:image-off" width={20} aria-hidden />
        {text.t("noPreviews")}
      </div>
    );
  const at = Math.min(index, previews.length - 1);
  const step = (by: number) =>
    setIndex((at + by + previews.length) % previews.length);
  const current = previews[at];

  return (
    <section className={styles.gallery} aria-label={text.t("previews")}>
      <figure className={styles.stage}>
        <button
          type="button"
          className={styles.stageOpen}
          aria-label={text.t("openPreview", { title: current.title })}
          onClick={() => setFull(true)}
        >
          {/* biome-ignore lint/performance/noImgElement: stored or inline plugin images, nothing for next/image to optimize */}
          <img src={current.src} alt={current.title} />
          <span className={styles.stageZoom} aria-hidden>
            <Icon icon="lucide:maximize-2" width={16} />
          </span>
        </button>
        {previews.length > 1 && (
          <>
            <button
              type="button"
              className={styles.arrow}
              data-side="prev"
              aria-label={text.t("previousPreview")}
              onClick={() => step(-1)}
            >
              <Icon icon="lucide:chevron-left" width={20} />
            </button>
            <button
              type="button"
              className={styles.arrow}
              data-side="next"
              aria-label={text.t("nextPreview")}
              onClick={() => step(1)}
            >
              <Icon icon="lucide:chevron-right" width={20} />
            </button>
          </>
        )}
        <figcaption className={styles.caption}>
          {previews.length > 1 && `${at + 1} / ${previews.length} · `}
          {current.title}
        </figcaption>
      </figure>
      {previews.length > 1 && (
        <div className={styles.thumbs}>
          {previews.map((p, i) => (
            <button
              key={p.src}
              type="button"
              className={styles.thumb}
              aria-pressed={i === at}
              onClick={() => setIndex(i)}
            >
              {/* biome-ignore lint/performance/noImgElement: see above */}
              <img src={p.src} alt="" loading="lazy" />
              <span>{p.title}</span>
            </button>
          ))}
        </div>
      )}
      {full && (
        <Lightbox
          images={previews}
          index={at}
          onIndex={setIndex}
          onClose={() => setFull(false)}
          labels={{
            dialog: text.t("previews"),
            close: text.t("closePreview"),
            previous: text.t("previousPreview"),
            next: text.t("nextPreview"),
          }}
        />
      )}
    </section>
  );
}
