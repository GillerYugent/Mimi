package tasks

import "time"

type TaskStatus string

const (
	StatusBacklog    TaskStatus = "backlog"
	StatusTodo       TaskStatus = "todo"
	StatusInProgress TaskStatus = "in_progress"
	StatusReview     TaskStatus = "review"
	StatusDone       TaskStatus = "done"
)

type TaskPriority string

const (
	PriorityLow    TaskPriority = "low"
	PriorityMedium TaskPriority = "medium"
	PriorityHigh   TaskPriority = "high"
	PriorityUrgent TaskPriority = "urgent"
)

type Task struct {
	ID             string       `json:"id"`
	ProjectID      string       `json:"projectId"`
	ParentTaskID   *string      `json:"parentTaskId,omitempty"`
	Title          string       `json:"title"`
	Description    string       `json:"description"`
	Status         TaskStatus   `json:"status"`
	Priority       TaskPriority `json:"priority"`
	Labels         []string     `json:"labels"`
	AssigneeID     *string      `json:"assigneeId,omitempty"`
	Deadline       *time.Time   `json:"deadline,omitempty"`
	CommitSHA      *string      `json:"commitSha,omitempty"`
	PullRequestURL *string      `json:"pullRequestUrl,omitempty"`
	SortOrder      int64        `json:"order"`
	CreatedBy      string       `json:"createdBy"`
	CreatedAt      time.Time    `json:"createdAt"`
	UpdatedAt      time.Time    `json:"updatedAt"`
}

type CreateRequest struct {
	ProjectID      string        `json:"projectId"`
	ParentTaskID   *string       `json:"parentTaskId,omitempty"`
	Title          string        `json:"title"`
	Description    string        `json:"description"`
	Status         *TaskStatus   `json:"status,omitempty"`
	Priority       *TaskPriority `json:"priority,omitempty"`
	Labels         []string      `json:"labels"`
	AssigneeID     *string       `json:"assigneeId,omitempty"`
	Deadline       *time.Time    `json:"deadline,omitempty"`
	CommitSHA      *string       `json:"commitSha,omitempty"`
	PullRequestURL *string       `json:"pullRequestUrl,omitempty"`
	SortOrder      *int64        `json:"order,omitempty"`
}

type UpdateRequest struct {
	Title          *string       `json:"title,omitempty"`
	Description    *string       `json:"description,omitempty"`
	Status         *TaskStatus   `json:"status,omitempty"`
	Priority       *TaskPriority `json:"priority,omitempty"`
	Labels         *[]string     `json:"labels,omitempty"`
	AssigneeID     *string       `json:"assigneeId,omitempty"`
	Deadline       *time.Time    `json:"deadline,omitempty"`
	CommitSHA      *string       `json:"commitSha,omitempty"`
	PullRequestURL *string       `json:"pullRequestUrl,omitempty"`
	SortOrder      *int64        `json:"order,omitempty"`
	// ClearAssignee и ClearDeadline — выставить поля в NULL. Без них nil
	// в PATCH трактуется как «оставить как есть».
	ClearAssignee bool `json:"clearAssignee,omitempty"`
	ClearDeadline bool `json:"clearDeadline,omitempty"`
}

type ListFilters struct {
	ProjectID  string
	Status     TaskStatus
	AssigneeID string
	Label      string
	Priority   TaskPriority
	Search     string
	// IncludeSubtasks — по умолчанию подзадачи не попадают в общий список
	// (чтобы Kanban-доска не дублировала их): они показываются только внутри
	// родительской задачи через /tasks/{id}/subtasks.
	IncludeSubtasks bool
}

type Stats struct {
	Total      int `json:"total"`
	InProgress int `json:"inProgress"`
	Done       int `json:"done"`
	Overdue    int `json:"overdue"`
}
