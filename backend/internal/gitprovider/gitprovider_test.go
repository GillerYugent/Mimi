package gitprovider

import "testing"

func TestParseRepoPath(t *testing.T) {
	cases := []struct {
		in   string
		want string
		err  bool
	}{
		{"https://github.com/GillerYugent/Mimi", "GillerYugent/Mimi", false},
		{"https://github.com/GillerYugent/Mimi.git", "GillerYugent/Mimi", false},
		{"https://github.com/GillerYugent/Mimi/", "GillerYugent/Mimi", false},
		{"git@github.com:GillerYugent/Mimi.git", "GillerYugent/Mimi", false},
		{"https://gitlab.com/group/sub/project", "group/sub/project", false},
		{"https://gitlab.com/group/sub/project.git", "group/sub/project", false},
		{"", "", true},
	}
	for _, tc := range cases {
		got, err := ParseRepoPath(tc.in)
		if tc.err {
			if err == nil {
				t.Errorf("input %q: ожидалась ошибка", tc.in)
			}
			continue
		}
		if err != nil {
			t.Errorf("input %q: неожиданная ошибка: %v", tc.in, err)
			continue
		}
		if got != tc.want {
			t.Errorf("input %q: want %q, got %q", tc.in, tc.want, got)
		}
	}
}

func TestRegistry_For(t *testing.T) {
	r := NewRegistry()
	if _, err := r.For("github"); err != nil {
		t.Errorf("github: %v", err)
	}
	if _, err := r.For("gitlab"); err != nil {
		t.Errorf("gitlab: %v", err)
	}
	if _, err := r.For("bitbucket"); err == nil {
		t.Errorf("ожидался ErrUnsupported для bitbucket")
	}
}
