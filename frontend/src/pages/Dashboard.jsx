import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const [rooms, setRooms] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState('');

  const { user } = useAuth();
  const navigate = useNavigate();

  // Load user's active/past rooms
  useEffect(() => {
    loadMyRooms();
  }, []);

  async function loadMyRooms() {
    try {
      setLoading(true);
      setError('');
      const res = await roomApi.getMyRooms();
      if (res.success) {
        setRooms(res.rooms);
      }
    } catch (err) {
      setError(err.message || 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRoom() {
    try {
      setCreateLoading(true);
      setError('');
      const res = await roomApi.createRoom();
      if (res.success && res.room) {
        navigate(`/room/${res.room.code}`);
      }
    } catch (err) {
      setError(err.message || 'Could not create room');
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleJoinRoom(e) {
    e.preventDefault();
    const cleanCode = joinCode.trim().toUpperCase();
    if (!cleanCode) {
      setError('Please enter a 6-character room code.');
      return;
    }

    try {
      setJoinLoading(true);
      setError('');
      const res = await roomApi.joinRoom(cleanCode);
      if (res.success && res.room) {
        navigate(`/room/${res.room.code}`);
      }
    } catch (err) {
      setError(err.message || 'Failed to join room');
    } finally {
      setJoinLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      
      {/* Top Banner / Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Create Room Box */}
        <div className="bg-white border border-slate-300 p-6 rounded shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">
              Create a Duel Room
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Start a new private 1v1 match. A random seeded problem will be chosen, and a 6-character code will be generated for your opponent to join.
            </p>
          </div>
          <div className="mt-6">
            <button
              onClick={handleCreateRoom}
              disabled={createLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2.5 rounded transition"
            >
              {createLoading ? 'Generating Room...' : '+ Create New Room'}
            </button>
          </div>
        </div>

        {/* Join Room Box */}
        <div className="bg-white border border-slate-300 p-6 rounded shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">
              Join Existing Room
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Have a 6-character room code from your opponent? Enter it below to occupy Player 2 and immediately begin the duel.
            </p>
          </div>
          <form onSubmit={handleJoinRoom} className="mt-6 flex items-center space-x-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE (e.g. ROOM01)"
              maxLength={6}
              className="w-48 px-3 py-2 border border-slate-300 rounded text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
            />
            <button
              type="submit"
              disabled={joinLoading}
              className="bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2.5 rounded transition"
            >
              {joinLoading ? 'Joining...' : 'Join Room'}
            </button>
          </form>
        </div>

      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
          {error}
        </div>
      )}

      {/* My Rooms Table */}
      <div className="bg-white border border-slate-300 rounded shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              My Duels
            </h3>
            <p className="text-xs text-slate-500">
              Rooms you created or joined. Reconnect anytime.
            </p>
          </div>
          <button
            onClick={loadMyRooms}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading rooms...</div>
        ) : rooms.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            You have not joined any duel rooms yet. Create or join one above!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Opponent</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Winner</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rooms.map((room) => {
                  const isPlayer1 = room.player1_id === user?.id;
                  const opponentName = isPlayer1
                    ? room.player2_username || 'Waiting...'
                    : room.player1_username || 'Host';

                  let statusBadgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
                  if (room.status === 'ACTIVE') {
                    statusBadgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
                  } else if (room.status === 'FINISHED') {
                    statusBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                  }

                  let winnerText = '—';
                  if (room.winner_id) {
                    winnerText = room.winner_id === user?.id ? 'You won' : 'Opponent won';
                  }

                  return (
                    <tr key={room.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">
                        {room.code}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {isPlayer1 ? 'Player 1 (Host)' : 'Player 2'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {opponentName}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 font-semibold text-[10px] border rounded ${statusBadgeColor}`}>
                          {room.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {winnerText}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/room/${room.code}`)}
                          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-3 py-1 border border-slate-300 rounded"
                        >
                          Open Room
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
