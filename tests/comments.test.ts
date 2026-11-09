import { describe, expect, it } from 'vitest';
import { createSceneComment, deleteSceneComment, unresolvedCommentCount, updateSceneComment } from '../src/utils/comments';

describe('scene comments', () => {
  it('creates a clamped comment with defaults', () => {
    const comment = createSceneComment('scene1', 120, -5, '  这里要改  ');
    expect(comment.sceneId).toBe('scene1');
    expect(comment.x).toBe(100);
    expect(comment.y).toBe(0);
    expect(comment.text).toBe('这里要改');
    expect(comment.resolved).toBe(false);
    expect(comment.author).toBe('我');
  });

  it('updates, resolves and deletes a comment', () => {
    const comment = createSceneComment('scene1', 10, 20, '文字太小');
    let comments = [comment];
    expect(unresolvedCommentCount(comments)).toBe(1);
    comments = updateSceneComment(comments, comment.id, { resolved: true });
    expect(comments[0].resolved).toBe(true);
    expect(comments[0].updatedAt).toBeTypeOf('number');
    expect(unresolvedCommentCount(comments)).toBe(0);
    expect(deleteSceneComment(comments, comment.id)).toEqual([]);
  });
});
