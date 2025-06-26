// Verifica se a função showNotification está disponível, se não, cria uma versão simples
if (typeof showNotification !== 'function') {
    window.showNotification = function(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        return Promise.resolve({
            remove: () => {}
        });
    };
}

// Função para obter a localização do usuário
function obterLocalizacao() {
    console.log('Solicitando localização do usuário...');
    
    // Verifica se o navegador suporta geolocalização
    if (!navigator.geolocation) {
        const msg = 'Seu navegador não suporta geolocalização.';
        console.error('ERRO:', msg);
        showNotification(msg, 'error');
        return Promise.reject(new Error(msg));
    }
    
    // Opções para a solicitação de geolocalização
    const options = {
        enableHighAccuracy: true,  // Tenta obter a localização mais precisa possível
        timeout: 10000,           // Tempo máximo de espera (10 segundos)
        maximumAge: 0             // Não usar posição em cache
    };
    
    return new Promise((resolve, reject) => {
        // Mostrar notificação de carregamento
        let loadingNotification = null;
        showNotification('Buscando sua localização...', 'info', 10000)
            .then(notification => {
                loadingNotification = notification;
            });
        
        navigator.geolocation.getCurrentPosition(
            // Sucesso
            (position) => {
                // Remover notificação de carregamento
                if (loadingNotification && typeof loadingNotification.remove === 'function') {
                    loadingNotification.remove();
                }
                
                const { latitude, longitude, accuracy } = position.coords;
                console.log('Localização obtida com sucesso:', { latitude, longitude, accuracy });
                
                // Mostrar notificação de sucesso
                showNotification('Localização encontrada!', 'success', 3000);
                
                // Retornar os dados da localização
                resolve({
                    lat: latitude,
                    lng: longitude,
                    accuracy: accuracy,
                    timestamp: position.timestamp
                });
            },
            // Erro
            (error) => {
                // Remover notificação de carregamento
                if (loadingNotification && typeof loadingNotification.remove === 'function') {
                    loadingNotification.remove();
                }
                
                let errorMessage = 'Não foi possível obter sua localização. ';
                
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Permissão de localização negada. Ative nas configurações do navegador.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Informações de localização não disponíveis.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Tempo de espera da localização expirado. Tente novamente.';
                        break;
                    default:
                        errorMessage = 'Erro desconhecido ao obter localização.';
                }
                
                console.error('Erro na geolocalização:', errorMessage, error);
                showNotification(errorMessage, 'error');
                reject(new Error(errorMessage));
            },
            options
        );
    });
}

// Função para centralizar o mapa na localização do usuário
function centralizarNoUsuario() {
    return obterLocalizacao().then(position => {
        if (!window.map || !window.L) {
            console.warn('Mapa não está disponível para centralização');
            return position;
        }
        
        const { lat, lng, accuracy } = position;
        
        // Centraliza o mapa
        window.map.setView([lat, lng], 15, {
            animate: true,
            duration: 1,
            easeLinearity: 0.25
        });
        
        // Adiciona ou atualiza o marcador de localização
        if (window.userLocationMarker) {
            window.map.removeLayer(window.userLocationMarker);
        }
        
        window.userLocationMarker = window.L.marker([lat, lng], {
            title: 'Sua localização',
            icon: window.L.divIcon({
                className: 'user-location-marker',
                html: '📍',
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            }),
            zIndexOffset: 1000
        }).addTo(window.map);
        
        // Adiciona popup com informações
        window.userLocationMarker.bindPopup(`
            <div style="text-align: center;">
                <strong>Sua localização</strong><br>
                Precisão: ~${Math.round(accuracy)} metros
            </div>
        `).openPopup();
        
        return position;
    });
}

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('Módulo de geolocalização carregado');
    
    // Adiciona estilos para o marcador de localização
    const style = document.createElement('style');
    style.textContent = `
        .user-location-marker {
            font-size: 24px;
            text-shadow: 0 0 3px #000, 0 0 5px #000;
            filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.7));
        }
    `;
    document.head.appendChild(style);
    
    // Tenta obter a localização automaticamente
    // Mas não mostra erro se falhar, pois o usuário pode querer ativar manualmente
    obterLocalizacao().catch(() => {
        // Ignora erros no carregamento automático
    });
});

// Expõe as funções globalmente
window.GeolocationManager = {
    obterLocalizacao,
    centralizarNoUsuario
};
