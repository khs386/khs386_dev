'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ymd } from '../lib/date'
import { PRIORITY_LABEL, STATUS_LABEL, profileName } from '../lib/tasks'

export default function TaskItem({ task, profiles, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const today = ymd()
  const isDone = task.status === 'done'
  const isOverdue = !isDone && task.due_date && task.due_date < today

  async function update(patch) {
    const { error } = await supabase.from('tasks').update(patch).eq('id', task.id)
    if (error) alert('저장 실패: ' + error.message)
    else onChanged()
  }

  function toggleDone() {
    if (isDone) update({ status: 'todo', completed_at: null })
    else update({ status: 'done', completed_at: new Date().toISOString() })
  }

  function changeStatus(status) {
    update({ status, completed_at: status === 'done' ? new Date().toISOString() : null })
  }

  async function remove() {
    if (!confirm(`"${task.title}" 업무를 삭제할까요?`)) return
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) alert('삭제 실패: ' + error.message)
    else onChanged()
  }

  function startEdit() {
    setForm({
      title: task.title,
      due_date: task.due_date || '',
      priority: task.priority,
      assignee_id: task.assignee_id || '',
    })
    setEditing(true)
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    await update({
      title: form.title.trim(),
      due_date: form.due_date || null,
      priority: Number(form.priority),
      assignee_id: form.assignee_id || null,
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <li className="task-item">
        <form className="task-edit" onSubmit={saveEdit}>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            autoFocus
          />
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            {[1, 2, 3].map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
          <select
            value={form.assignee_id}
            onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
          >
            <option value="">담당자 없음</option>
            {profiles.map((p) => (
              <option key={p.user_id} value={p.user_id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-sm">
            저장
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
            취소
          </button>
        </form>
      </li>
    )
  }

  return (
    <li className={`task-item${isDone ? ' done' : ''}`}>
      <input type="checkbox" checked={isDone} onChange={toggleDone} />
      <span className="task-title">{task.title}</span>
      {task.priority === 1 && <span className="badge badge-high">높음</span>}
      {task.priority === 3 && <span className="badge">낮음</span>}
      {task.due_date && (
        <span className={isOverdue ? 'badge badge-overdue' : 'muted'}>~{task.due_date}</span>
      )}
      {task.assignee_id && <span className="badge badge-who">{profileName(profiles, task.assignee_id)}</span>}
      <span className="task-actions">
        <select value={task.status} onChange={(e) => changeStatus(e.target.value)}>
          {Object.entries(STATUS_LABEL).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <button className="link-btn" onClick={startEdit}>
          수정
        </button>
        <button className="link-btn danger" onClick={remove}>
          삭제
        </button>
      </span>
    </li>
  )
}
