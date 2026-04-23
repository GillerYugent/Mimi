import { useEffect, useRef } from 'react'
import { useTasks } from '@/store/taskStore'
import { useAuth } from '@/store/authStore'
import { useNotifications } from '@/store/notificationStore'
import { useProjects } from '@/store/projectStore'

// Subscribes to task changes and generates notifications for the current user
// (assignment, status changes). Mirrors the notifications-service behaviour in ТЗ.
export function useNotificationEffects() {
  const prevAssignments = useRef<Map<string, string | undefined>>(new Map())
  const prevStatuses = useRef<Map<string, string>>(new Map())
  const initialized = useRef(false)

  useEffect(() => {
    return useTasks.subscribe((state) => {
      const currentUser = useAuth.getState().currentUser()
      const notify = useNotifications.getState().notify
      const getProject = useProjects.getState().getProject

      // On first run, just snapshot — no notifications.
      if (!initialized.current) {
        for (const t of state.tasks) {
          prevAssignments.current.set(t.id, t.assigneeId)
          prevStatuses.current.set(t.id, t.status)
        }
        initialized.current = true
        return
      }

      if (!currentUser) return

      for (const t of state.tasks) {
        const prevAssignee = prevAssignments.current.get(t.id)
        if (prevAssignee !== t.assigneeId && t.assigneeId === currentUser.id) {
          if (currentUser.notificationPrefs.taskAssigned) {
            const project = getProject(t.projectId)
            notify({
              userId: currentUser.id,
              type: 'task_assigned',
              title: 'Вам назначена задача',
              body: `«${t.title}»${project ? ` — ${project.title}` : ''}`,
              link: `/project/${t.projectId}`,
            })
          }
        }

        const prevStatus = prevStatuses.current.get(t.id)
        if (prevStatus && prevStatus !== t.status && t.assigneeId === currentUser.id) {
          if (currentUser.notificationPrefs.taskStatusChanged) {
            const project = getProject(t.projectId)
            notify({
              userId: currentUser.id,
              type: 'task_status_changed',
              title: `Задача: статус → ${t.status}`,
              body: `«${t.title}»${project ? ` — ${project.title}` : ''}`,
              link: `/project/${t.projectId}`,
            })
          }
        }

        prevAssignments.current.set(t.id, t.assigneeId)
        prevStatuses.current.set(t.id, t.status)
      }
    })
  }, [])
}
