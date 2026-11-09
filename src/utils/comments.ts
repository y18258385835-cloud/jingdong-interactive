import type { SceneComment } from '../types';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function createSceneComment(
  sceneId: string,
  x: number,
  y: number,
  text: string,
  author = '我',
): SceneComment {
  return {
    id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sceneId,
    x: Math.round(clamp(x, 0, 100) * 100) / 100,
    y: Math.round(clamp(y, 0, 100) * 100) / 100,
    text: text.trim().slice(0, 4000),
    author: author.trim().slice(0, 80) || '我',
    createdAt: Date.now(),
    resolved: false,
  };
}

export function updateSceneComment(
  comments: SceneComment[] | undefined,
  id: string,
  patch: Partial<SceneComment>,
): SceneComment[] {
  return (comments || []).map((comment) => (
    comment.id === id
      ? { ...comment, ...patch, id: comment.id, updatedAt: Date.now() }
      : comment
  ));
}

export function deleteSceneComment(comments: SceneComment[] | undefined, id: string): SceneComment[] {
  return (comments || []).filter((comment) => comment.id !== id);
}

export function unresolvedCommentCount(comments: SceneComment[] | undefined): number {
  return (comments || []).filter((comment) => !comment.resolved).length;
}
