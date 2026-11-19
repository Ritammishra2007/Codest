import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { roomApi, submissionApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Room() {
  const { code } = useParams();
  const { user } = useAuth();

  const [room, setRoom] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [sourceCode, setSourceCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Draft persistence key in localStorage
  const draftKey = user && room ? `codest_draft_${user.id}_${room.id}` : null;

  // Track polling state and avoid overlapping fetches
  const isPollingRef = useRef(false);
  const pollTimerRef = useRef(null);

  // Generic Python starter template if no draft exists
  const defaultStarterCode = `# Write your Python 3 solution below.
# Standard input is provided via sys.stdin.
# Print your answer to standard output.

import sys

def main():
    # Read input from standard input
    pass

if __name__ == '__main__':
    main()
`;

  // Fetch room data and user submissions
  const fetchRoomState = useCallback(async (isInitial = false) => {
    if (isPollingRef.current && !isInitial) return;

    try {
      isPollingRef.current = true;
      const res = await roomApi.getRoom(code);
      if (res.success && res.room) {
        setRoom(res.room);

        // If room is ACTIVE or FINISHED, also fetch my submissions
        if (res.room.status === 'ACTIVE' || res.room.status === 'FINISHED') {
          const subRes = await submissionApi.getMySubmissions(res.room.id);
          if (subRes.success) {
            setSubmissions(subRes.submissions);
          }
        }
      }
    } catch (err) {
      if (isInitial) {
        setError(err.message || 'Could not load room details');
      }
    } finally {
      isPollingRef.current = false;
      if (isInitial) setLoading(false);
    }
  }, [code]);

  // Initial load
  useEffect(() => {
    fetchRoomState(true);
  }, [fetchRoomState]);

  // Restore draft from localStorage when room loads
  useEffect(() => {
    if (draftKey) {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft !== null) {
        setSourceCode(savedDraft);
      } else {
        setSourceCode(defaultStarterCode);
      }
    }
  }, [draftKey]);

  // Autosave draft on edit
  function handleCodeChange(e) {
    const newCode = e.target.value;
    setSourceCode(newCode);
    if (draftKey) {
      localStorage.setItem(draftKey, newCode);
    }
  }

  // Polling loop (~2 seconds)
  useEffect(() => {
    // If room is FINISHED, stop polling
    if (!room || room.status === 'FINISHED') {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    pollTimerRef.current = setInterval(() => {
      fetchRoomState(false);
    }, 2000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [room?.status, fetchRoomState]);

  // Copy Room Code to clipboard
  function handleCopyCode() {
    if (!room?.code) return;
    navigator.clipboard.writeText(room.code);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }

  // Submit code for judging
  async function handleSubmitCode(e) {
    e.preventDefault();
    if (!sourceCode.trim()) {
      setError('Cannot submit empty code.');
      return;
    }

    try {
      setSubmitLoading(true);
      setError('');
      await submissionApi.submit(room.id, sourceCode);
      // Immediately refresh state
      await fetchRoomState(false);
    } catch (err) {
      setError(err.message || 'Submission was rejected.');
    } finally {
      setSubmitLoading(false);
    }
  }

  // Check if player has a submission currently in flight
  const hasInFlightSubmission = submissions.some((s) =>
    ['PENDING', 'RUNNING'].includes(s.status)
  );

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center text-xs text-slate-500">
        Loading room {code}...
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 bg-white border border-red-200 rounded">
        <h2 className="text-sm font-bold text-red-700">Error Loading Room</h2>
        <p className="text-xs text-slate-600 mt-2">{error}</p>
        <Link to="/dashboard" className="inline-block mt-4 text-xs text-blue-600 hover:underline">
          &larr; Return to Dashboard
        </Link>
      </div>
    );
  }

  // Waiting screen
  if (room.status === 'WAITING') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white border border-slate-300 rounded shadow-sm p-8 text-center space-y-6">
          
          <div>
            <span className="text-[11px] font-semibold tracking-wider text-amber-700 uppercase bg-amber-50 border border-amber-200 px-2.5 py-1 rounded">
              Room Status: Waiting for Opponent
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-4">Private Duel Room</h1>
            <p className="text-xs text-slate-500 mt-1">
              Share the code below with your opponent. The duel will begin the instant they join.
            </p>
          </div>

          {/* 6-character Code Display */}
          <div className="p-6 bg-slate-50 border border-slate-200 rounded max-w-sm mx-auto">
            <span className="text-xs text-slate-500 block uppercase font-medium">Room Code</span>
            <span className="text-3xl font-mono font-bold tracking-widest text-slate-900 block my-2">
              {room.code}
            </span>
            <button
              onClick={handleCopyCode}
              className="text-xs bg-white hover:bg-slate-100 text-slate-700 font-semibold px-4 py-1.5 border border-slate-300 rounded transition"
            >
              {copyFeedback ? '✓ Copied!' : 'Copy Code'}
            </button>
          </div>

          {/* Player Slots */}
          <div className="border border-slate-200 rounded text-left text-xs divide-y divide-slate-200 max-w-sm mx-auto">
            <div className="px-4 py-2.5 flex justify-between items-center">
              <span className="text-slate-500 font-medium">Player 1 (Host):</span>
              <span className="font-semibold text-slate-900">{room.player1_username || 'Host'}</span>
            </div>
            <div className="px-4 py-2.5 flex justify-between items-center bg-slate-50">
              <span className="text-slate-500 font-medium">Player 2:</span>
              <span className="italic text-slate-400">Waiting to join...</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            Problem details remain hidden until Player 2 occupies the room.
          </div>
        </div>
      </div>
    );
  }

  // Active duel or finished screen
  const isFinished = room.status === 'FINISHED';
  const isWinner = room.winner_id === user?.id;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      
      {/* Top Banner / Room Status Bar */}
      <div className="bg-white border border-slate-300 rounded p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-lg font-bold text-slate-900">
              Room {room.code}
            </h1>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 border rounded uppercase ${
                isFinished
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}
            >
              {room.status}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Player 1: <strong className="text-slate-700">{room.player1_username}</strong> vs Player 2: <strong className="text-slate-700">{room.player2_username}</strong>
          </div>
        </div>

        {/* Finished Result Banner */}
        {isFinished && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-2 rounded text-xs font-semibold">
            {isWinner ? (
              <span>🏆 You won this duel! Your solution passed first.</span>
            ) : (
              <span>Duel Finished. Winner: {room.winner_id === room.player1_id ? room.player1_username : room.player2_username}</span>
            )}
          </div>
        )}

        <div className="text-xs text-slate-500">
          <Link to="/dashboard" className="text-blue-600 hover:underline">
            &larr; Exit to Dashboard
          </Link>
        </div>
      </div>

      {/* Main 2-Column Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Left Column: Problem Statement & Samples */}
        <div className="bg-white border border-slate-300 rounded p-6 space-y-6 shadow-sm">
          {room.problem ? (
            <>
              {/* Problem Title & Meta */}
              <div className="border-b border-slate-200 pb-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">
                    {room.problem.title}
                  </h2>
                  <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 border border-slate-200 rounded font-semibold uppercase">
                    {room.problem.difficulty}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Time limit per test: {room.problem.time_limit_ms} ms
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Statement
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {room.problem.description}
                </p>
              </div>

              {/* Input Format */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Input Format
                </h3>
                <p className="text-xs text-slate-700 font-mono bg-slate-50 p-2.5 border border-slate-200 rounded whitespace-pre-line">
                  {room.problem.input_format}
                </p>
              </div>

              {/* Output Format */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Output Format
                </h3>
                <p className="text-xs text-slate-700 font-mono bg-slate-50 p-2.5 border border-slate-200 rounded whitespace-pre-line">
                  {room.problem.output_format}
                </p>
              </div>

              {/* Constraints */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Constraints
                </h3>
                <p className="text-xs text-slate-700 font-mono bg-slate-50 p-2.5 border border-slate-200 rounded whitespace-pre-line">
                  {room.problem.constraints_text}
                </p>
              </div>

              {/* Visible Sample Test Cases */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Sample Tests
                </h3>
                <div className="space-y-3">
                  {room.problem.samples?.map((sample) => (
                    <div key={sample.position} className="border border-slate-300 rounded overflow-hidden text-xs">
                      <div className="bg-slate-100 px-3 py-1 font-semibold text-slate-700 border-b border-slate-200">
                        Sample #{sample.position}
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-slate-200">
                        <div className="p-3">
                          <span className="text-[10px] text-slate-400 block font-bold uppercase mb-1">Standard Input</span>
                          <pre className="font-mono text-slate-800 whitespace-pre-wrap">{sample.input}</pre>
                        </div>
                        <div className="p-3 bg-slate-50">
                          <span className="text-[10px] text-slate-400 block font-bold uppercase mb-1">Expected Output</span>
                          <pre className="font-mono text-slate-800 whitespace-pre-wrap">{sample.expected_output}</pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-500">Problem details not available.</div>
          )}
        </div>

        {/* Right Column: Code Editor & Submissions */}
        <div className="space-y-6">
          
          {/* Solution Editor Card */}
          <div className="bg-white border border-slate-300 rounded p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Python 3 Solution
                </h2>
                <span className="text-[11px] text-slate-500">
                  Draft auto-saved locally. Earliest passing submission wins.
                </span>
              </div>
              {hasInFlightSubmission && (
                <span className="text-[11px] text-blue-700 font-semibold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded animate-pulse">
                  Judging in progress...
                </span>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                {error}
              </div>
            )}

            {/* Plain Textarea Code Editor */}
            <form onSubmit={handleSubmitCode}>
              <textarea
                value={sourceCode}
                onChange={handleCodeChange}
                rows={16}
                spellCheck={false}
                disabled={isFinished || submitLoading}
                placeholder="# Write your Python 3 code here..."
                className="w-full p-3 font-mono text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 resize-y"
              />

              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {isFinished ? 'Duel has ended.' : 'Ensure your code reads from stdin and writes to stdout.'}
                </span>

                <button
                  type="submit"
                  disabled={isFinished || submitLoading || hasInFlightSubmission || !sourceCode.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold text-xs px-5 py-2.5 rounded transition"
                >
                  {submitLoading
                    ? 'Submitting...'
                    : hasInFlightSubmission
                    ? 'Judging Current Solution...'
                    : 'Submit Solution'}
                </button>
              </div>
            </form>
          </div>

          {/* My Submissions Table */}
          <div className="bg-white border border-slate-300 rounded shadow-sm overflow-hidden">
            <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                My Submission History
              </h3>
              <span className="text-[10px] text-slate-500">
                Server sequence determines winning order
              </span>
            </div>

            {submissions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No submissions made yet in this room.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2">Seq #</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Verdict</th>
                      <th className="px-4 py-2 text-right">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {submissions.map((sub) => {
                      let verdictColor = 'text-slate-600';
                      if (sub.verdict === 'ACCEPTED') {
                        verdictColor = 'text-emerald-700 font-bold';
                      } else if (sub.verdict) {
                        verdictColor = 'text-red-700 font-semibold';
                      }

                      return (
                        <tr key={sub.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-mono font-bold text-slate-800">
                            #{sub.sequence_number}
                          </td>
                          <td className="px-4 py-2 text-slate-600">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded">
                              {sub.status}
                            </span>
                          </td>
                          <td className={`px-4 py-2 font-mono text-[11px] ${verdictColor}`}>
                            {sub.verdict || 'PENDING'}
                          </td>
                          <td className="px-4 py-2 text-right text-slate-500 font-mono text-[11px]">
                            {new Date(sub.submitted_at).toLocaleTimeString()}
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

      </div>

    </div>
  );
}
