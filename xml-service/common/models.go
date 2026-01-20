package common

type JobRequest struct {
	JobID         string `json:"job_id"`
	WebhookURL    string `json:"webhook_url"`
	MapperVersion string `json:"mapper_version,omitempty"`
	XSDVersion    string `json:"xsd_version,omitempty"`
}

type WebhookPayload struct {
	JobID   string `json:"job_id"`
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
}
