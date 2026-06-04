import React, { useState, useEffect } from "react";
import Layout from "@theme/Layout";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import styles from "./meetup.module.css";

function SpeakerList({ speakers }) {
  if (!speakers || speakers.length === 0) return null;
  return (
    <ul className={styles.speakers}>
      {speakers.map((s, i) => (
        <li key={i} className={styles.speaker}>
          {s.name}
          {s.organisation && <span className={styles.organisation}> · {s.organisation}</span>}
        </li>
      ))}
    </ul>
  );
}

const DESCRIPTION_LIMIT = 160;

function VideoCard({ video }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = video.description && video.description.length > DESCRIPTION_LIMIT;
  const displayedDescription =
    isLong && !expanded
      ? video.description.slice(0, DESCRIPTION_LIMIT).trimEnd() + "…"
      : video.description;

  return (
    <article className={styles.card}>
      <a
        href={video.youtube_url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.thumbnailLink}
        aria-label={`Watch ${video.title} on YouTube`}
      >
        <div className={styles.thumbnailWrapper}>
          <img
            src={video.thumbnail}
            alt={video.title}
            className={styles.thumbnail}
            loading="lazy"
          />
          <div className={styles.playOverlay} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="white" width="52" height="52">
              <circle cx="12" cy="12" r="12" fill="rgba(0,0,0,0.55)" />
              <path d="M9.5 7.5l8 4.5-8 4.5V7.5z" />
            </svg>
          </div>
        </div>
      </a>
      <div className={styles.cardBody}>
        <span className={styles.badge}>Meetup #{video.meetup}</span>
        <h3 className={styles.cardTitle}>
          <a href={video.youtube_url} target="_blank" rel="noopener noreferrer">
            {video.title}
          </a>
        </h3>
        <time className={styles.date} dateTime={video.date}>
          {video.date}
        </time>
        <SpeakerList speakers={video.speakers} />
        {video.description && (
          <div className={styles.descriptionWrapper}>
            <p className={styles.description}>{displayedDescription}</p>
            {isLong && (
              <button
                className={styles.toggleButton}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default function Meetup() {
  const { siteConfig } = useDocusaurusContext();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${siteConfig.baseUrl}data/videos.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setVideos(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [siteConfig.baseUrl]);

  return (
    <Layout
      title="WoT Community Meetups"
      description="Archive of Web of Things Community Group meetup presentation recordings"
    >
      <main className={styles.page}>
        {loading && <p className={styles.status}>Loading…</p>}
        {error && (
          <p className={styles.status}>Could not load videos ({error}).</p>
        )}
        {!loading && !error && videos.length === 0 && (
          <p className={styles.status}>No videos available yet.</p>
        )}

        {videos.length > 0 && (
          <div className={styles.grid}>
            {videos.map((video) => (
              <VideoCard key={video.meetup} video={video} />
            ))}
          </div>
        )}
      </main>
    </Layout>
  );
}
