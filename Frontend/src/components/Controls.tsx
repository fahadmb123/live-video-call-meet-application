type ControlsProps = {
  muted: boolean;
  cameraOff: boolean;
  onMute: () => void;
  onCamera: () => void;
  onLeave: () => void;
};

function Controls({
  muted,
  cameraOff,
  onMute,
  onCamera,
  onLeave,
}: ControlsProps) {
  return (
    <section className="controls">
      <button
        className={`control-button ${
          muted ? "active" : ""
        }`}
        onClick={onMute}
      >
        <span className="control-icon">
          {muted ? "🔇" : "🎤"}
        </span>

        <span>
          {muted
            ? "Unmute"
            : "Mute"}
        </span>
      </button>

      <button
        className={`control-button ${
          cameraOff ? "active" : ""
        }`}
        onClick={onCamera}
      >
        <span className="control-icon">
          {cameraOff
            ? "📷"
            : "📹"}
        </span>

        <span>
          {cameraOff
            ? "Turn Camera On"
            : "Turn Camera Off"}
        </span>
      </button>

      <button
        className="leave-button"
        onClick={onLeave}
      >
        <span className="control-icon">
          ☎
        </span>

        Leave Room
      </button>
    </section>
  );
}

export default Controls;