package gitprovider

// Registry создаёт и хранит реализации Provider'ов по имени. Сервис
// использует его как точку выбора в рантайме: registry.For("github").
type Registry struct {
	providers map[string]Provider
}

func NewRegistry() *Registry {
	return &Registry{
		providers: map[string]Provider{
			"github": NewGitHub(),
			"gitlab": NewGitLab(),
		},
	}
}

// For возвращает провайдера или ErrUnsupported, если имя неизвестно.
func (r *Registry) For(name string) (Provider, error) {
	p, ok := r.providers[name]
	if !ok {
		return nil, ErrUnsupported
	}
	return p, nil
}
