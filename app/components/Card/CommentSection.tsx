/**
 * 코멘트 입력 섹션 컴포넌트
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import CommentItemComponent, { CommentItem } from './CommentItem';
import styles from './CommentSection.module.css';

const COMMENTS_PER_PAGE = 4;

export default function CommentSection() {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [newContent, setNewContent] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showRules, setShowRules] = useState<boolean>(false);

  // API URL은 기본 URL + '/api/'로 생성
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const apiUrl = baseUrl ? `${baseUrl}/api/` : '/api/';

  const setPlaceholderComments = useCallback(() => {
    setComments([
      {
        id: 1,
        parentHeaderId: null,
        content: 'This is a placeholder comment. API endpoint is not configured yet. Please set up Next.js API Routes.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isEdited: 0,
        isDeleted: 0,
        version: 1,
        headerId: 1,
        tailId: 1,
        hashedUser: 'user_abc123',
        children: [],
      },
    ]);
    setTotalCount(1);
  }, []);

  const fetchComments = useCallback(async (page: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}comments?page=${page}&limit=${COMMENTS_PER_PAGE}`);
      
      // 응답이 OK가 아니거나 404인 경우 플레이스홀더로 처리
      if (!res.ok) {
        if (res.status === 404) {
            setPlaceholderComments();
          return;
        }
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          await res.json();
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      // Content-Type 확인 (JSON이 아닌 경우 HTML 응답일 수 있음)
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
          setPlaceholderComments();
        return;
      }
      
      const data = await res.json();
      const newComments = data.data || [];
      
      setComments(newComments);
      setTotalCount(data.totalCount || 0);
    } catch {
      // API 연결 실패 시 플레이스홀더 데이터 사용
      setPlaceholderComments();
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, setPlaceholderComments]);

  // 컴포넌트 마운트 시 즉시 첫 페이지 댓글 로드
  useEffect(() => {
    let cancelled = false;
    
    const loadComments = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${apiUrl}comments?page=1&limit=${COMMENTS_PER_PAGE}`);
        
        if (cancelled) return;
        
        // 응답이 OK가 아니거나 404인 경우 플레이스홀더로 처리
        if (!res.ok) {
          if (res.status === 404) {
            setPlaceholderComments();
            return;
          }
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            await res.json();
          }
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        // Content-Type 확인 (JSON이 아닌 경우 HTML 응답일 수 있음)
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          setPlaceholderComments();
          return;
        }
        
        const data = await res.json();
        const newComments = data.data || [];
        
        if (cancelled) return;
        
        setComments(newComments);
        setTotalCount(data.totalCount || 0);
      } catch {
        if (cancelled) return;
        
        // API 연결 실패 시 플레이스홀더 데이터 사용
        setPlaceholderComments();
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    
    // 마운트 시 즉시 첫 페이지 로드
    loadComments();
    
    return () => {
      cancelled = true;
    };
  }, [apiUrl, setPlaceholderComments]); // 마운트 시 한 번만 실행

  // 페이지 변경 시 댓글 로드 (마운트 후)
  useEffect(() => {
    // 첫 마운트가 아니고 currentPage가 1이 아닐 때만 로드
    if (currentPage === 1) return;
    
    let cancelled = false;
    
    const loadComments = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${apiUrl}comments?page=${currentPage}&limit=${COMMENTS_PER_PAGE}`);
        
        if (cancelled) return;
        
        // 응답이 OK가 아니거나 404인 경우 플레이스홀더로 처리
        if (!res.ok) {
          if (res.status === 404) {
            setPlaceholderComments();
            return;
          }
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            await res.json();
          }
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        // Content-Type 확인 (JSON이 아닌 경우 HTML 응답일 수 있음)
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          setPlaceholderComments();
          return;
        }
        
        const data = await res.json();
        const newComments = data.data || [];
        
        if (cancelled) return;
        
        setComments(newComments);
        setTotalCount(data.totalCount || 0);
      } catch {
        if (cancelled) return;
        
        // API 연결 실패 시 플레이스홀더 데이터 사용
        setPlaceholderComments();
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    
    loadComments();
    
    return () => {
      cancelled = true;
    };
  }, [currentPage, apiUrl, setPlaceholderComments]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    const totalPages = Math.ceil(totalCount / COMMENTS_PER_PAGE);
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handleCreateComment = async () => {
    if (!newContent || !newPassword) {
      alert('Please enter both comment content and password.');
      return;
    }
    try {
      const requestBody = { parentHeaderId: null, content: newContent, userPassword: newPassword };
      const requestUrl = `${apiUrl}comments`;
      const res = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      // 응답이 OK가 아닌 경우
      if (!res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          alert(`Failed: ${data.error || 'Unknown error'}`);
        } else {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return;
      }
      
      // Content-Type 확인
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('API endpoint not found or invalid response');
      }
      
      await res.json();
      setNewContent('');
      setNewPassword('');
      // 새 댓글 생성 후 첫 페이지로 리셋
      setCurrentPage(1);
      fetchComments(1);
    } catch {
      alert('Failed to create comment. API endpoint may not be configured. Please check the API Routes setup.');
    }
  };

  const totalPages = Math.ceil(totalCount / COMMENTS_PER_PAGE) || 1;
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;


  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Comments</h2>

      {/* 정보 텍스트 */}
      <p className={styles.infoText}>
        * Your username is generated based on a hash of your IP address.
      </p>

      {/* 코멘트 입력 폼 */}
      <div className={styles.formContainer}>
        <div className={styles.formGrid}>
          <textarea
            className={styles.textarea}
            rows={3}
            placeholder="Enter your comment"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
          />
          <div className={styles.inputGroup}>
            <input
              type="password"
              className={styles.input}
              placeholder="Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button
              onClick={handleCreateComment}
              className={styles.submitButton}
            >
              Submit Comment
            </button>
          </div>
        </div>
      </div>

      {/* 규칙 토글 */}
      <div className={styles.rulesToggle}>
        <button
          onClick={() => setShowRules((prev) => !prev)}
          className={styles.rulesButton}
        >
          {showRules ? 'Hide Commenting Rules' : 'Show Commenting Rules'}
        </button>
        {showRules && (
          <ul className={styles.rulesList}>
            <li>When a comment is created or edited, the author&apos;s identity is generated by hashing the user&apos;s current IP address.</li>
            <li>Edited comments maintain a viewable history.</li>
            <li>Deleted comments are marked as (deleted) and their history is no longer accessible, though the hashed IP remains visible.</li>
            <li>These rules apply equally to replies.</li>
          </ul>
        )}
      </div>

      {/* 코멘트 목록 (스크롤 가능) */}
      <div className={styles.commentsList}>
        {isLoading ? (
          <div className={styles.loadingMessage}>
            <p>Loading comments...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className={styles.emptyMessage}>
            <p>No comments yet. Be the first to comment!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItemComponent
              key={comment.id}
              comment={comment}
              apiUrl={apiUrl}
              onReload={() => fetchComments(currentPage)}
            />
          ))
        )}
      </div>

      {/* 페이징 (컨테이너 밖, 고정 위치) */}
      <div className={styles.pagination}>
        <button
          disabled={!canGoPrev}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handlePrevPage();
          }}
          className={styles.paginationButton}
          style={{ pointerEvents: 'auto', zIndex: 1000, position: 'relative' }}
        >
          Previous
        </button>
        <span className={styles.paginationInfo}>
          {currentPage} / {totalPages}
        </span>
        <button
          disabled={!canGoNext}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleNextPage();
          }}
          className={styles.paginationButton}
          style={{ pointerEvents: 'auto', zIndex: 1000, position: 'relative' }}
        >
          Next
        </button>
      </div>

      {/* Footer */}
      <p className={styles.footer}>
        Powered by OCI Autonomous Database
      </p>
    </div>
  );
}
