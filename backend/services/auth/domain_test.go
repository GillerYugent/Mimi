package auth

import (
	"encoding/json"
	"testing"
)

func TestNotificationPrefs_DefaultIsAllOn(t *testing.T) {
	p := DefaultPrefs()
	if !p.TaskAssigned || !p.TaskStatusChanged || !p.TeamInvited || !p.MentionedInDoc {
		t.Fatalf("по умолчанию все уведомления должны быть включены: %+v", p)
	}
}

func TestNotificationPrefs_RoundTrip(t *testing.T) {
	in := NotificationPrefs{
		TaskAssigned:      false,
		TaskStatusChanged: true,
		TeamInvited:       false,
		MentionedInDoc:    true,
	}
	b, err := json.Marshal(in)
	if err != nil {
		t.Fatal(err)
	}
	var out NotificationPrefs
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatal(err)
	}
	if out != in {
		t.Fatalf("несовпадение: in=%+v out=%+v", in, out)
	}
}

func TestNotificationPrefs_UnmarshalEmpty(t *testing.T) {
	var p NotificationPrefs
	if err := p.UnmarshalJSONB(nil); err != nil {
		t.Fatal(err)
	}
	if p != DefaultPrefs() {
		t.Fatalf("пустой JSONB должен инициализироваться дефолтом, получено %+v", p)
	}
}

func TestUpdateProfileRequest_OmitsUnsetFields(t *testing.T) {
	req := UpdateProfileRequest{}
	b, _ := json.Marshal(req)
	if string(b) != "{}" {
		t.Fatalf("ожидался пустой JSON, получено %s", string(b))
	}
	name := "Maxim"
	req.Name = &name
	b, _ = json.Marshal(req)
	if want := `{"name":"Maxim"}`; string(b) != want {
		t.Fatalf("want %q, got %q", want, string(b))
	}
}
