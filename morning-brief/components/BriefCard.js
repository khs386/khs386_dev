import { PRIORITY_LABEL } from '../lib/tasks'

function TaskLine({ task }) {
  return (
    <li>
      <span>{task.title}</span>
      {task.priority === 1 && <span className="badge badge-high">높음</span>}
      {task.due_date && <span className="muted"> ~{task.due_date}</span>}
    </li>
  )
}

function Section({ icon, title, items, empty, render }) {
  return (
    <div className="brief-section">
      <h4>
        {icon} {title} {items.length > 0 && <span className="count">{items.length}</span>}
      </h4>
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul>{items.map((t) => (render ? render(t) : <TaskLine key={t.id} task={t} />))}</ul>
      )}
    </div>
  )
}

export default function BriefCard({ content }) {
  return (
    <div className="brief-body">
      <Section
        icon="🎯"
        title="오늘의 우선순위"
        items={content.top3 || []}
        empty="미완료 업무가 없습니다. 여유로운 하루!"
        render={(t) => (
          <li key={t.id}>
            <strong>{t.title}</strong>
            <span className="badge">{PRIORITY_LABEL[t.priority]}</span>
            {t.due_date && <span className="muted"> ~{t.due_date}</span>}
          </li>
        )}
      />
      <Section icon="📌" title="오늘 마감" items={content.due_today || []} empty="오늘 마감 업무가 없습니다." />
      <Section
        icon="⚠️"
        title="지연 업무"
        items={content.overdue || []}
        empty="지연된 업무가 없습니다."
        render={(t) => (
          <li key={t.id} className="overdue">
            <span>{t.title}</span>
            <span className="muted"> ~{t.due_date}</span>
          </li>
        )}
      />
      <Section
        icon="✅"
        title="어제 완료"
        items={content.done_yesterday || []}
        empty="어제 완료 처리한 업무가 없습니다."
        render={(t) => <li key={t.id}>{t.title}</li>}
      />
    </div>
  )
}
