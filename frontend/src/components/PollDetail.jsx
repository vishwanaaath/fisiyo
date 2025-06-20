// src/components/PollDetail.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useRef } from "react";
import { Link } from "react-router-dom";
import {
  MessageSquare,
  Share,
  Bookmark,
  ChevronUp,
  ChevronDown,
  User,
  X,
  Loader2,
  Send,
  Check,
} from "lucide-react";

const PollDetail = ({ isModal = false, backgroundLocation = null }) => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { pollId } = useParams();
  const [poll, setPoll] = useState(state?.poll || null);
  const [user, setUser] = useState(state?.user || null);
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const currentUserId = user?._id || user?.sub;
  const [loading, setLoading] = useState(!poll);
  const [newComment, setNewComment] = useState("");
  const [comments, setComments] = useState([]);
  const [isCommenting, setIsCommenting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [hoveredUser, setHoveredUser] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ top: 0, left: 0 });
  const [replyContent, setReplyContent] = useState("");
  const [commentVotes, setCommentVotes] = useState({});
  const [selectedOption, setSelectedOption] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [localOptions, setLocalOptions] = useState([]);
  const [localTotalVotes, setLocalTotalVotes] = useState(0);
  const hoverTimeoutRef = useRef(null);
  const [isHoveringCard, setIsHoveringCard] = useState(false);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // User profile card component
  const UserProfileCard = ({ user, position }) => {
    if (!user) return null;

    return (
      <div
        className="fixed z-50 bg-[#161617] border border-[#1E1E1E] rounded-xl p-4 w-64 shadow-lg pointer-events-none"
        style={{
          top: position.top + 10,
          left: Math.max(10, Math.min(position.left, window.innerWidth - 270)),
        }}
        onMouseEnter={() => {
          setIsHoveringCard(true);
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
          }
        }}
        onMouseLeave={() => {
          setIsHoveringCard(false);
          hoverTimeoutRef.current = setTimeout(() => {
            setHoveredUser(null);
          }, 300);
        }}>
        <div className="flex flex-col items-center">
          <img
            className="w-16 h-16 rounded-full mb-3"
            src={
              user.userDp
                ? `https://xeadzuobunjecdivltiu.supabase.co/storage/v1/object/public/posts/uploads/${user.userDp}`
                : "/default-avatar.png"
            }
            alt="avatar"
            onError={(e) => {
              e.target.src = "/default-avatar.png";
            }}
          />
          <h3 className="text-white font-medium">n/{user.handle}</h3>
          <button
            onClick={() => console.log(`followed ${user.handle}`)}
            className="mt-3 w-full py-1 text-white rounded-l border border-white font-medium hover:bg-[#AD49E1]/90 transition-colors pointer-events-auto">
            Follow
          </button>
        </div>
      </div>
    );
  };

  // Fetch poll and comments
  useEffect(() => {
    const fetchData = async () => {
      if (!poll && pollId) {
        try {
          setLoading(true);

          // Fetch poll
          const pollRes = await fetch(
            `http://localhost:3000/api/polls/${pollId}`
          );
          if (!pollRes.ok) throw new Error("Failed to fetch poll");
          const pollData = await pollRes.json();
          setPoll(poll);
          setLocalOptions(pollData.options);
          setLocalTotalVotes(pollData.totalVotes);

          // Check if current user has voted
          if (pollData.votedUsers.includes(currentUserId)) {
            setHasVoted(true);
          }

          // Fetch comments
          const commentsRes = await fetch(
            `http://localhost:3000/api/polls/${pollId}/comments`
          );
          if (!commentsRes.ok) throw new Error("Failed to fetch comments");
          const commentsData = await commentsRes.json();
          setComments(commentsData);
        } catch (err) {
          console.error("Error fetching data:", err);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchData();
  }, [poll, pollId, currentUserId]);

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return "now";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  // Poll expiration check
  const now = new Date();
  const expiration = new Date(poll?.expiresAt);
  const hasExpired = expiration < now;

  // Calculate time remaining
  const timeRemaining = hasExpired
    ? "Ended"
    : `${Math.ceil((expiration - now) / (1000 * 60 * 60))}h remaining`;

  // Calculate percentages for each option
  const calculatePercentage = (votes) => {
    return localTotalVotes > 0
      ? Math.round((votes / localTotalVotes) * 100)
      : 0;
  };

  // Handle voting
  const handleVote = async (optionIndex) => {
    if (hasVoted || !user || !poll) return;

    // Optimistic UI update
    setSelectedOption(optionIndex);
    setHasVoted(true);

    const updatedOptions = [...localOptions];
    updatedOptions[optionIndex].votes =
      (updatedOptions[optionIndex].votes || 0) + 1;

    setLocalOptions(updatedOptions);
    setLocalTotalVotes(localTotalVotes + 1);

    try {
      const response = await fetch(
        `http://localhost:3000/api/polls/${pollId}/vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            optionIndex,
            userId: currentUserId,
          }),
        }
      );

      if (!response.ok) throw new Error("Voting failed");
    } catch (err) {
      console.error("Error voting:", err);
      // Revert on error
      setHasVoted(false);
      setSelectedOption(null);
      setLocalOptions(poll.options);
      setLocalTotalVotes(poll.totalVotes);
    }
  };

  // Determine if we should show results
  const showResults = hasExpired || poll?.showVotesBeforeExpire || hasVoted;

  // Comment rendering
  const renderComment = (comment, depth = 0) => {
    const isReplying = replyingTo === comment._id;

    return (
      <div
        key={comment._id}
        className={`pl-2 mt-3 ${
          depth > 0 ? "border-l border-[#1E1E1E]" : ""
        } transition-colors duration-200`}>
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-0.5">
              <Link
                to={`/n/${comment.handle}`}
                state={{ user: user, handle: comment.handle }}
                className="">
                <img
                  className="w-8 h-8 rounded-full object-cover"
                  src={
                    comment.userDp
                      ? `https://xeadzuobunjecdivltiu.supabase.co/storage/v1/object/public/posts/uploads/${comment.userDp}`
                      : "/default-avatar.png"
                  }
                  alt="avatar"
                  onError={(e) => {
                    e.target.src = "/default-avatar.png";
                  }}
                />
              </Link>
              <div>
                <Link
                  to={`/n/${comment.handle}`}
                  state={{ user: user, handle: comment.handle }}>
                  <span
                    className="text-sm font-medium text-white hover:underline cursor-pointer"
                    onMouseEnter={(e) => {
                      const rect = e.target.getBoundingClientRect();
                      setHoveredUser({
                        handle: comment.handle,
                        userDp: comment.userDp,
                      });
                      setHoverPosition({
                        top: rect.bottom + window.scrollY,
                        left: rect.left + window.scrollX,
                      });

                      if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                      }
                    }}
                    onMouseLeave={() => {
                      if (!isHoveringCard) {
                        hoverTimeoutRef.current = setTimeout(() => {
                          setHoveredUser(null);
                        }, 300);
                      }
                    }}>
                    n/{comment.handle || "Anonymous"}
                  </span>
                </Link>
                <span className="text-xs text-[#818384] ml-2">
                  {new Date(comment.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                    hour12: true,
                  })}
                </span>
              </div>
            </div>

            <p className="text-[#d7dadc] pl-11 mb-0.5 mr-2">{comment.body}</p>

            <div className="pl-11">
              <div className="pl-0 flex items-center gap-4 mt-0 text-sm text-[#818384]">
                <button
                  onClick={() =>
                    setReplyingTo((prev) =>
                      prev === comment._id ? null : comment._id
                    )
                  }
                  className="hover:text-[#AD49E1] font-medium">
                  {isReplying ? "Cancel" : "Reply"}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCommentVote(comment._id, "up")}
                    className={`p-1.5 rounded-full transition-colors ${
                      commentVotes[comment._id] === "up"
                        ? "text-[#AD49E1] bg-[#AD49E1]/10"
                        : "hover:bg-[#AD49E1]/10 hover:text-[#AD49E1]"
                    }`}>
                    <ChevronUp size={18} />
                  </button>
                  <span className="text-xs font-bold text-[#d7dadc]">
                    {comment.voteCount || 0}
                  </span>
                  <button
                    onClick={() => handleCommentVote(comment._id, "down")}
                    className={`p-1.5 rounded-full transition-colors ${
                      commentVotes[comment._id] === "down"
                        ? "text-[#7193ff] bg-[#7193ff]/10"
                        : "hover:bg-[#7193ff]/10 hover:text-[#7193ff]"
                    }`}>
                    <ChevronDown size={18} />
                  </button>
                </div>

                {currentUserId === comment.author && (
                  <button
                    onClick={() =>
                      handleDeleteComment(comment._id, user.handle)
                    }
                    disabled={deletingCommentId === comment._id}
                    className={`text-[#818384] hover:text-red-500 font-medium transition-colors ${
                      deletingCommentId === comment._id ? "animate-pulse" : ""
                    }`}>
                    {deletingCommentId === comment._id ? (
                      <Loader2 className="animate-spin h-4 w-4 inline mr-1" />
                    ) : null}
                    Delete
                  </button>
                )}
              </div>

              {isReplying && (
                <div className="mt-3">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl p-3 text-white placeholder-[#818384] focus:outline-none focus:border-[#AD49E1]/50 transition-colors"
                    placeholder="Write a reply..."
                    rows={3}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => handleReplySubmit(comment._id)}
                      disabled={!replyContent.trim()}
                      className={`flex items-center gap-2 font-medium py-1.5 px-5 rounded-full text-sm transition-all ${
                        !replyContent.trim()
                          ? "bg-[#AD49E1]/50 cursor-not-allowed"
                          : "bg-[#AD49E1] hover:bg-[#AD49E1]/90"
                      }`}>
                      <Send size={14} />
                      Reply
                    </button>
                  </div>
                </div>
              )}
            </div>

            {comment.replies?.map((reply) => renderComment(reply, depth + 1))}
          </div>
        </div>
      </div>
    );
  };

  // Comment submission
  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user || !poll) return;

    try {
      setIsCommenting(true);
      const commentData = {
        body: newComment,
        author: user?._id || user?.sub,
        handle: user?.handle || user?.userHandle || "Anonymous",
        userDp: user.profilePicture,
      };

      const response = await fetch(
        `http://localhost:3000/api/polls/${poll._id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(commentData),
        }
      );

      if (!response.ok) throw new Error("Failed to post comment");

      const savedComment = await response.json();
      setComments((prev) => [
        {
          ...savedComment,
          voteCount: 0,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setNewComment("");
    } catch (error) {
      console.error("Error posting comment:", error);
    } finally {
      setIsCommenting(false);
    }
  };

  // Comment vote handler
  const handleCommentVote = (commentId, voteType) => {
    setCommentVotes((prev) => ({
      ...prev,
      [commentId]: prev[commentId] === voteType ? null : voteType,
    }));
  };

  // Close modal handler
  const handleClose = () => {
    if (isModal && backgroundLocation) {
      navigate(backgroundLocation.pathname + backgroundLocation.search, {
        state: backgroundLocation.state,
      });
    } else {
      navigate(-1);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-[#0A0A0A] ${
          isModal ? "backdrop-blur-sm" : ""
        }`}>
        <div className="flex flex-col items-center">
          <Loader2 className="animate-spin text-[#AD49E1] h-10 w-10" />
          <p className="mt-4 text-[#d7dadc]">Loading poll...</p>
        </div>
      </div>
    );
  }

  // Poll not found state
  if (!poll) {
    return (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-[#0A0A0A] ${
          isModal ? "backdrop-blur-sm" : ""
        }`}>
        <div className="bg-[#161617] p-8 rounded-2xl text-center">
          <p className="text-xl text-[#d7dadc] mb-4">Poll not found</p>
          <button
            onClick={handleClose}
            className="bg-[#AD49E1] hover:bg-[#AD49E1]/90 text-white font-medium py-2 px-6 rounded-full transition-all">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${
        isModal
          ? "fixed inset-0 z-50 overflow-y-auto"
          : "min-h-screen bg-[#030303]"
      }`}>
      {isModal && (
        <div
          onClick={handleClose}
          className="fixed inset-0 bg-[#AD49E1]/20 backdrop-blur-xs transition-opacity"
        />
      )}

      <div
        className={`relative ${
          isModal
            ? "flex items-center justify-center min-h-screen sm:pt-20 pt-0"
            : ""
        }`}>
        <div
          className={`bg-[#0A0A0A] sm:rounded-2xl overflow-hidden border border-[#1E1E1E] shadow-2xl ${
            isModal ? "w-full max-w-4xl" : "max-w-4xl mx-auto my-8"
          }`}>
          {/* Header */}
          <div className="sm:p-6 p-2 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-0">
                <img
                  className="w-12 h-12 object-cover object-center"
                  src={poll.community_dp}
                  alt="community"
                />
                <div>
                  <Link to={`/c/${poll.communityHandle}`}>
                    <h2 className="text-white sm:text-base text-sm font-medium">
                      c/{poll.communityHandle || "Astronomy"}
                    </h2>
                  </Link>

                  <p className="text-[#818384] sm:text-sm text-sm flex items-center">
                    <span>
                      n/
                      {(poll.userHandle || "anonymous")
                        .toLowerCase()
                        .replace(/\s+/g, "")}
                    </span>
                    <span className="mx-1.5">·</span>
                    {formatDate(poll.createdAt)} ago
                  </p>
                </div>
              </div>
              <h1 className="sm:text-2xl text-lg font-bold px-1 text-white mt-4 leading-tight">
                {poll.question || "Poll Question"}
              </h1>
              <p className="text-[#818384] text-sm px-1 mt-1">
                {localTotalVotes} votes • {timeRemaining}
              </p>
            </div>

            {isModal && (
              <button
                onClick={handleClose}
                className="text-[#818384] hover:text-white p-2 rounded-full transition-colors">
                <X size={24} />
              </button>
            )}
          </div>

          {/* Poll Content */}
          <div className="sm:px-6 px-3 pb-4">
            <div className="space-y-3 mb-6">
              {localOptions.map((option, index) => {
                const percentage = showResults
                  ? calculatePercentage(option.votes || 0)
                  : 0;

                const isSelected = selectedOption === index;
                const userVotedThisOption =
                  isSelected ||
                  (hasVoted && poll.votedUsers.includes(currentUserId));

                return (
                  <button
                    key={index}
                    className={`w-full text-left rounded-lg overflow-hidden transition-all duration-300 ${
                      showResults
                        ? "bg-[#1a1a1a]"
                        : "bg-[#1a1a1a] hover:bg-[#222]"
                    } ${userVotedThisOption ? "ring-2 ring-[#AD49E1]" : ""}`}
                    onClick={() => handleVote(index)}
                    disabled={showResults || !user}>
                    <div className="flex justify-between px-3 py-2.5">
                      <span className="text-[#d7dadc] text-sm">
                        {option.text}
                      </span>

                      {showResults && (
                        <span className="text-[#818384] text-sm">
                          {percentage}%
                        </span>
                      )}
                    </div>

                    {showResults && (
                      <div className="h-1.5 bg-[#333] w-full">
                        <div
                          className="h-full bg-[#AD49E1] transition-all duration-700"
                          style={{ width: `${percentage}%` }}></div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Engagement Bar */}
            <div className="flex items-center gap-4 text-[#818384] border-t border-[#1E1E1E] p-5">
              <button className="flex items-center gap-1.5 hover:text-white transition-colors">
                <MessageSquare size={18} />
                <span className="text-sm">{comments.length} Comments</span>
              </button>
            </div>
          </div>

          {/* Comment Input */}
          <div className="p-4 border-t border-[#1E1E1E]">
            <h3 className="text-xl font-semibold text-white mb-2">
              Add a comment
            </h3>
            <div className="relative mb-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl p-4 text-white min-h-[120px] placeholder-[#818384] focus:outline-none focus:border-[#AD49E1]/50 transition-colors"
                placeholder="Share your thoughts..."
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={handleSubmitComment}
                  disabled={isCommenting || !newComment.trim()}
                  className={`flex items-center gap-2 font-medium cursor-pointer py-2 px-6 rounded-full transition-all ${
                    isCommenting || !newComment.trim()
                      ? "bg-[#AD49E1]/50 cursor-not-allowed"
                      : "bg-[#AD49E1] hover:bg-[#AD49E1]/90"
                  }`}>
                  {isCommenting ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4" />
                      Posting...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Comment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="border-t p-3 border-[#1E1E1E]">
            {comments.length > 0 ? (
              <div className="divide-y divide-[#1E1E1E]">
                {comments.map((comment) => renderComment(comment))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="inline-block p-4 rounded-full bg-[#161617] mb-4">
                  <MessageSquare className="text-[#818384] w-8 h-8" />
                </div>
                <h4 className="text-xl font-semibold text-white">
                  No Comments Yet
                </h4>
                <p className="text-[#818384] mt-2">
                  Be the first to share your thoughts
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hover Card - positioned at the end */}
      {hoveredUser && (
        <UserProfileCard user={hoveredUser} position={hoverPosition} />
      )}
    </div>
  );
};

export default PollDetail;
