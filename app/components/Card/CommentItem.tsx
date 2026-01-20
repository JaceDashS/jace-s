/**
 * 코멘트 아이템 컴포넌트 (댓글 및 대댓글)
 */
'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './CommentItem.module.css';

export interface CommentItem {
  id: number;
  parentHeaderId?: number | null;
  content: string | null;
  createdAt: string;
  updatedAt: string;
  isEdited: number;
  isDeleted: number;
  version: number;
  editedCommentId?: number | null;
  headerId: number;
  tailId: number;
  hashedUser: string;
  children?: CommentItem[];
}

interface CommentItemProps {
  comment: CommentItem;
  apiUrl?: string;
  onReload?: () => void;
}

interface UpdateCommentPayload {
  content: string;
  userPassword: string;
  newHashedUserIP?: string;
}

interface DeleteCommentPayload {
  userPassword: string;
  newHashedUserIP?: string;
}

// 시간 포맷팅 헬퍼 함수
const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = (now.getTime() - date.getTime()) / 1000;
  const minutes = diffInSeconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;

  if (days < 30) {
    if (days >= 1) {
      const dayCount = Math.floor(days);
      return `${dayCount} day${dayCount > 1 ? 's' : ''} ago`;
    } else if (hours >= 1) {
      const hourCount = Math.floor(hours);
      return `${hourCount} hour${hourCount > 1 ? 's' : ''} ago`;
    } else if (minutes >= 1) {
      const minuteCount = Math.floor(minutes);
      return `${minuteCount} minute${minuteCount > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  } else {
    return date.toLocaleString();
  }
};

export default function CommentItemComponent({ comment, apiUrl, onReload }: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [history, setHistory] = useState<CommentItem[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showChild, setShowChild] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replyPassword, setReplyPassword] = useState('');

  const isParent = comment.parentHeaderId === null || comment.parentHeaderId === undefined;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchHistory = async () => {
    if (!apiUrl) return;
    setIsHistoryLoading(true);
    const url = `${apiUrl}comments/${comment.id}/history`;
    try {
      const response = await fetch(url);
      
      // Content-Type 확인
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('API endpoint not found or invalid response');
      }
      
      const data = await response.json();
      if (response.ok) {
        setHistory(data.history);
      } else {
        console.error('Fetch comment history error:', data.error);
        alert(`Failed to fetch comment history: ${data.error}${data.details ? ` - ${data.details}` : ''}`);
      }
    } catch (error) {
      console.error('Fetch comment history error:', error);
      alert(`Failed to fetch comment history: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleUpdateComment = async () => {
    if (!apiUrl || !editContent || !editPassword) {
      alert('Please enter the update content and password.');
      return;
    }
    try {
      const url = `${apiUrl}comments/${comment.id}`;
      const payload: UpdateCommentPayload = { content: editContent, userPassword: editPassword };
      if (!isParent) {
        payload.newHashedUserIP = comment.hashedUser;
      }
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      // Content-Type 확인
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('API endpoint not found or invalid response');
      }
      
      const data = await response.json();
      if (response.ok) {
        alert(isParent ? 'Comment has been updated.' : 'Reply has been updated.');
        setIsEditing(false);
        if (onReload) onReload();
      } else {
        alert(`Update failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Update comment error:', error);
      alert('Failed to update comment. API endpoint may not be configured.');
    }
  };

  const handleDeleteComment = async () => {
    if (!apiUrl || !deletePassword) {
      alert('Please enter the password to delete.');
      return;
    }
    try {
      const url = `${apiUrl}comments/${comment.id}`;
      const payload: DeleteCommentPayload = { userPassword: deletePassword };
      if (!isParent) {
        payload.newHashedUserIP = comment.hashedUser;
      }
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      // Content-Type 확인
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('API endpoint not found or invalid response');
      }
      
      const data = await response.json();
      if (response.ok) {
        alert(isParent ? 'Comment has been deleted.' : 'Reply has been deleted.');
        if (onReload) onReload();
      } else {
        alert(`Deletion failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Delete comment error:', error);
      alert('Failed to delete comment. API endpoint may not be configured.');
    }
  };

  const handleMenuSelect = (action: 'edit' | 'delete' | 'history') => {
    setShowMenu(false);
    if (action === 'edit') {
      setIsEditing(true);
      setEditContent(comment.content || '');
      setEditPassword('');
      setIsDeleting(false);
    } else if (action === 'delete') {
      setIsDeleting(true);
      setDeletePassword('');
      setIsEditing(false);
    } else if (action === 'history') {
      if (!showHistory) fetchHistory();
      setShowHistory((prev) => !prev);
    }
  };

  const toggleChild = () => {
    setShowChild((prev) => !prev);
    setShowMenu(false);
  };

  const childrenToRender: CommentItem[] = comment.children || [];
  const childButtonText = showChild
    ? 'Hide Replies'
    : childrenToRender.length > 0
      ? 'View Replies'
      : 'Write Reply';

  const handleCreateReply = async () => {
    if (!apiUrl || !replyContent || !replyPassword) {
      alert('Please enter the reply content and password.');
      return;
    }
    try {
      const response = await fetch(`${apiUrl}comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentHeaderId: comment.headerId,
          content: replyContent,
          userPassword: replyPassword,
        }),
      });
      
      // Content-Type 확인
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('API endpoint not found or invalid response');
      }
      
      const data = await response.json();
      if (response.ok) {
        alert('Reply has been created.');
        setReplyContent('');
        setReplyPassword('');
        if (onReload) onReload();
      } else {
        alert(`Reply creation failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Create reply error:', error);
      alert('Failed to create reply. API endpoint may not be configured.');
    }
  };

  return (
    <div className={`${styles.commentContainer} ${isParent ? styles.commentParent : styles.commentChild}`}>
      {/* 헤더 섹션 */}
      <div className={styles.header}>
        <div className={styles.userInfo}>
          <div>
            <div className={isParent ? styles.userName : styles.userNameChild}>
              {comment.hashedUser}
            </div>
            <div className={isParent ? styles.userTime : styles.userTimeChild}>
              {formatTime(comment.createdAt)}
            </div>
          </div>
        </div>
        {/* 부모 댓글과 대댓글 모두에 메뉴 버튼 표시 */}
        {comment.content !== null && (
          <div className={styles.menuContainer} ref={menuRef}>
            <button
              className={isParent ? styles.menuButtonParent : styles.menuButtonChild}
              onClick={() => setShowMenu((prev) => !prev)}
              aria-label={isParent ? 'Comment menu' : 'Reply menu'}
            >
              ...
            </button>
            {showMenu && (
              <div className={styles.dropdownMenu}>
                <div
                  className={isParent ? styles.dropdownItemParent : styles.dropdownItemChild}
                  onClick={() => handleMenuSelect('edit')}
                >
                  Edit
                </div>
                <div
                  className={isParent ? styles.dropdownItemParent : styles.dropdownItemChild}
                  onClick={() => handleMenuSelect('delete')}
                >
                  Delete
                </div>
                <div
                  className={isParent ? styles.dropdownItemParent : styles.dropdownItemChild}
                  onClick={() => handleMenuSelect('history')}
                >
                  {showHistory ? 'Hide History' : 'View History'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 댓글 내용 또는 수정 모드 */}
      <div className={isParent ? styles.content : styles.contentChild}>
        {isEditing ? (
          <div className={styles.editForm}>
            <div className={styles.editTextarea}>
              <textarea
                className={styles.textarea}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Content to update"
                rows={3}
              />
            </div>
            <div className={styles.editInputs}>
              <input
                type="password"
                className={styles.input}
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Password"
              />
              <button
                onClick={handleUpdateComment}
                className={`${styles.button} ${styles.buttonPrimary}`}
              >
                Confirm
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className={`${styles.button} ${styles.buttonSecondary}`}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>{comment.content === null ? <em className={styles.deletedText}>(deleted)</em> : comment.content}</>
        )}
      </div>


      {/* 삭제 모드 */}
      {isDeleting && !isEditing && (
        <div className={styles.deleteForm}>
          <input
            type="password"
            className={styles.deleteInput}
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="Delete Password"
          />
          <button
            onClick={handleDeleteComment}
            className={`${styles.button} ${styles.buttonPrimary}`}
          >
            Confirm
          </button>
          <button
            onClick={() => setIsDeleting(false)}
            className={`${styles.button} ${styles.buttonSecondary}`}
          >
            Cancel
          </button>
        </div>
      )}

      {/* 히스토리 섹션 */}
      {showHistory && (
        <div className={styles.historySection}>
          <strong className={styles.historyTitle}>
            {isParent ? 'Comment History' : 'Reply History'}
          </strong>
          {isHistoryLoading ? (
            <div className={styles.historyLoading}>Loading...</div>
          ) : history && history.length > 0 ? (
            <ul className={styles.historyList}>
              {history.map((hist) => (
                <li key={hist.id} className={styles.historyItem}>
                  <span className={styles.historyVersion}>Version {hist.version}:</span>{' '}
                  {hist.content === null ? <em>(deleted)</em> : hist.content}
                  <br />
                  <small className={styles.historyTime}>{formatTime(hist.createdAt)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.historyEmpty}>No history available</div>
          )}
        </div>
      )}

      {/* 부모 댓글만 대댓글 기능 */}
      {isParent && (
        <div>
          <button
            className={styles.replyButton}
            onClick={toggleChild}
          >
            {childButtonText}
          </button>
          {showChild && (
            <div className="mt-3">
              <div>
                {childrenToRender.length > 0 &&
                  childrenToRender.map((child) => (
                    <CommentItemComponent
                      key={child.id}
                      comment={child}
                      apiUrl={apiUrl}
                      onReload={onReload}
                    />
                  ))}
              </div>
              <div className={styles.replyForm}>
                <div className={styles.replyTextarea}>
                  <textarea
                    className={styles.textarea}
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Enter your reply content."
                    rows={3}
                  />
                </div>
                <div className={styles.replyInputs}>
                  <input
                    type="password"
                    className={styles.input}
                    value={replyPassword}
                    onChange={(e) => setReplyPassword(e.target.value)}
                    placeholder="Password"
                  />
                  <button
                    className={`${styles.button} ${styles.buttonPrimary}`}
                    onClick={handleCreateReply}
                  >
                    Submit
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
