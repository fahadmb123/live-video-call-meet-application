type JoinPageProps = {
  roomId: string;
  username: string;

  setRoomId: (
    value: string
  ) => void;

  setUsername: (
    value: string
  ) => void;

  onJoin: () => void;
};

function JoinPage({
  roomId,
  username,
  setRoomId,
  setUsername,
  onJoin,
}: JoinPageProps) {
  return (
    <div className="join-page">
      <div className="join-card">
        <div className="logo">
          <div className="logo-icon">
            M
          </div>

          <span>
            MeetSpace
          </span>
        </div>

        <h1>
          Join a Meeting
        </h1>

        <p className="join-description">
          Connect with your team and
          start a video conversation.
        </p>

        <div className="form-group">
          <label>
            Your Name
          </label>

          <input
            type="text"
            placeholder="Enter your name"
            value={username}
            onChange={(event) =>
              setUsername(
                event.target.value
              )
            }
          />
        </div>

        <div className="form-group">
          <label>
            Room ID
          </label>

          <input
            type="text"
            placeholder="Enter room ID"
            value={roomId}
            onChange={(event) =>
              setRoomId(
                event.target.value
              )
            }
          />
        </div>

        <button
          className="join-button"
          onClick={onJoin}
        >
          Join Room
        </button>

        <p className="join-footer">
          Enter the same room ID to
          meet with others.
        </p>
      </div>
    </div>
  );
}

export default JoinPage;