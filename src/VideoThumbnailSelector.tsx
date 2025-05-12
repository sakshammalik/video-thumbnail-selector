/* VideoThumbnailSelectorCustom.jsx */
import React, { useRef, useState } from 'react';
import './VideoThumbnailSelector.css';

const FRAME_COUNT = 12;
const SEGMENT_DURATION = 3; // ← fixed segment length in seconds

export default function VideoThumbnailSelector() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const timelineRef = useRef(null);
  const imgRef = useRef(null);
  const thumbnailImgRef = useRef(null);
  const playButtonRef = useRef(null);

  const [videoUrl, setVideoUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [thumbnails, setThumbnails] = useState([]);
  const [sliderValue, setSliderValue] = useState(0);
  const currentThumbRef = useRef('');
  const previewVideoRef = useRef(null);

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setVideoUrl(URL.createObjectURL(file));
    setThumbnails([]);
    currentThumbRef.current = '';
    imgRef.current.src = '';
    thumbnailImgRef.current.src = '';
    setSliderValue(0);
  };

  const onLoadedMetadata = () => {
    const vid = videoRef.current;
    setDuration(vid.duration);

    const canvas = canvasRef.current;
    canvas.width = vid.videoWidth / 4;
    canvas.height = vid.videoHeight / 4;

    const times = Array.from(
      { length: FRAME_COUNT },
      (_, i) => (vid.duration * i) / (FRAME_COUNT - 1)
    );

    Promise.all(
      times.map(
        (t) =>
          new Promise((resolve) => {
            const onSeeked = () => {
              const ctx = canvas.getContext('2d');
              ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
              resolve(canvas.toDataURL('image/jpeg'));
              vid.removeEventListener('seeked', onSeeked);
            };
            vid.addEventListener('seeked', onSeeked);
            vid.currentTime = t;
          })
      )
    ).then((frames) => {
      setThumbnails(frames);
      currentThumbRef.current = frames[0];
      imgRef.current.src = frames[0];
      thumbnailImgRef.current.src = frames[0];
    });
  };

  const seekAndCapture = (time) => {
    const vid = videoRef.current;
    const canvas = canvasRef.current;
    const onSeeked = () => {
      const ctx = canvas.getContext('2d');
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      currentThumbRef.current = dataUrl;
      imgRef.current.src = dataUrl;
      thumbnailImgRef.current.src = dataUrl;
      vid.removeEventListener('seeked', onSeeked);
    };
    vid.addEventListener('seeked', onSeeked);
    vid.currentTime = time;
  };

  const updatePosition = (clientX) => {
    const rect = timelineRef.current.getBoundingClientRect();
    let ratio = (clientX - rect.left) / rect.width;
    const maxStartFrac = Math.max(0, (duration - SEGMENT_DURATION) / duration);
    ratio = Math.min(Math.max(0, ratio), maxStartFrac);
    const t = ratio * duration;

    setSliderValue(t);
    seekAndCapture(t);
  };

  const onDragStart = (e) => {
    e.preventDefault();
    updatePosition(e.clientX || e.touches[0].clientX);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('touchmove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchend', onDragEnd);
  };
  const onDragMove = (e) => updatePosition(e.clientX || e.touches[0].clientX);
  const onDragEnd = (e) => {
    updatePosition(
      e.clientX || (e.changedTouches && e.changedTouches[0].clientX)
    );
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchend', onDragEnd);
  };

  const onThumbClick = (idx) => {
    const raw = (duration * idx) / (FRAME_COUNT - 1);
    const maxStart = Math.max(0, duration - SEGMENT_DURATION);
    const t = Math.min(raw, maxStart);

    setSliderValue(t);
    seekAndCapture(t);
  };

  const handlePlay = () => {
    const vid = previewVideoRef.current;
    if (!vid) return;

    // prepare video element
    vid.currentTime = sliderValue;
    vid.style.display = 'block';
    vid.style.position = 'static';
    imgRef.current.style.display = 'none';
    playButtonRef.current.style.display = 'none';
    vid.play();

    // pause when we reach the end of the 3s window
    const onTimeUpdate = () => {
      if (vid.currentTime >= sliderValue + SEGMENT_DURATION) {
        vid.pause();
        vid.removeEventListener('timeupdate', onTimeUpdate);
        vid.style.display = 'none';
        imgRef.current.style.display = 'block';
        playButtonRef.current.style.display = 'block';
      }
    };
    vid.addEventListener('timeupdate', onTimeUpdate);
  };

  return (
    <div className="thumbnail-selector-custom">
      {!videoUrl ? (
        <label className="upload-button">
          Choose video…
          <input
            type="file"
            accept="video/*"
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
        </label>
      ) : (
        <>
          <div className="preview">
            <img ref={imgRef} alt="Cover preview" />

            {/* ▶ play button */}
            <button
              className="play-button"
              onClick={handlePlay}
              ref={playButtonRef}
            >
              ▶
            </button>

            {/* hidden video for segment preview */}
            <video
              ref={previewVideoRef}
              className="preview-video"
              src={videoUrl}
              muted
              playsInline
            />
          </div>

          <video
            ref={videoRef}
            src={videoUrl}
            onLoadedMetadata={onLoadedMetadata}
            style={{ display: 'none' }}
            crossOrigin="anonymous"
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div
            className="timeline-strip"
            ref={timelineRef}
            onMouseDown={onDragStart}
            onTouchStart={onDragStart}
          >
            {thumbnails.map((t, i) => (
              <img
                key={i}
                src={t}
                alt={`frame ${i}`}
                onClick={() => onThumbClick(i)}
                className="thumbnail-img"
              />
            ))}

            {/* ← new selection-range overlay */}
            {duration > 0 && (
              <>
                <img
                  className="selection-range-img"
                  ref={thumbnailImgRef}
                  alt="thumbnail preview"
                  style={{
                    transform: 'scale(1.3)',
                    left: `${(sliderValue / duration) * 100}%`,
                  }}
                />
                <div
                  className="selection-range"
                  style={{
                    left: `${(sliderValue / duration) * 100}%`,
                    width: `${(SEGMENT_DURATION / duration) * 100}%`,
                  }}
                ></div>
              </>
            )}

            <div
              className="handle"
              style={{
                left: `${duration > 0 ? (sliderValue / duration) * 100 : 0}%`,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
