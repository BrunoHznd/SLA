/*
 * mapa.js
 * Script principal para o mapa de calor e interações – MotoTec
 */

'use strict';

// Namespace para evitar conflitos
const MapaApp = {
  // ====== Constantes e Configurações ======
  COORDENADAS_PRAIA_GRANDE: [-24.0167, -46.4667],
  ZOOM_PADRAO: 13,
  API_URL: '/api/demanda/',

  // ====== Variáveis Globais ======
  map: null,
  heatLayer: null,
  markersLayer: null,
  userMarker: null,
  pontoSelecionado: null,
  rotaAtiva: null,

  // ====== Inicialização do Mapa ======
  initMap: function() {
    return new Promise((resolve, reject) => {
      console.log('=== INÍCIO initMap() ===');
      console.log('Verificando se o Leaflet está disponível...');
      
      try {
        if (typeof L === 'undefined') {
          console.error('Leaflet não está disponível');
          throw new Error('Leaflet não está disponível');
        }

        console.log('Leaflet está disponível, versão:', L.version);
        console.log('Verificando se o Leaflet.heat está disponível...');

        // Verifica se o Leaflet.heat está disponível
        if (typeof L.heatLayer === 'undefined') {
          console.warn('Leaflet.heat não está disponível, tentando carregar...');
          // Tenta carregar dinamicamente
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
          script.onload = () => {
            console.log('Leaflet.heat carregado com sucesso');
            this._initMapAfterHeatLoad(resolve, reject);
          };
          script.onerror = () => {
            console.error('Falha ao carregar Leaflet.heat');
            // Mesmo que o heat não carregue, continua com o mapa básico
            console.warn('Continuando sem o plugin de calor...');
            this._initMapAfterHeatLoad(resolve, reject);
          };
          document.head.appendChild(script);
          return;
        } else {
          console.log('Leaflet.heat já está disponível');
        }

        this._initMapAfterHeatLoad(resolve, reject);
      } catch (error) {
        console.error('Erro ao inicializar mapa:', error);
        reject(error);
      }
    });
  },

  _initMapAfterHeatLoad: function(resolve, reject) {
    try {
      console.log('=== INÍCIO _initMapAfterHeatLoad() ===');
      console.log('Inicializando o mapa...');
      
      const mapElement = document.getElementById('map');
      if (!mapElement) {
        const errorMsg = 'Elemento #map não encontrado no DOM';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      console.log('Elemento do mapa encontrado:', {
        id: mapElement.id,
        width: mapElement.offsetWidth,
        height: mapElement.offsetHeight,
        style: {
          width: mapElement.style.width,
          height: mapElement.style.height
        }
      });

      // Garante que o container tem dimensões
      if (!mapElement.offsetWidth || !mapElement.offsetHeight) {
        console.log('Ajustando dimensões do container do mapa...');
        mapElement.style.width = '100%';
        mapElement.style.height = '500px';
        // Força um reflow
        void mapElement.offsetHeight;
        
        console.log('Novas dimensões do container:', {
          width: mapElement.offsetWidth,
          height: mapElement.offsetHeight
        });
      }

      // Se já existe uma instância do mapa, remove
      if (this.map) {
        console.log('Removendo instância anterior do mapa...');
        this.map.remove();
        this.map = null;
      }
      
      console.log('Criando nova instância do mapa...');
      // Cria nova instância do mapa
      try {
        this.map = L.map('map', {
          zoomControl: false,
          preferCanvas: false, // Desativa o canvas para melhor compatibilidade
          // Ativa zoom com a roda do mouse
          scrollWheelZoom: true,
          // Melhora a performance
          fadeAnimation: true,
          markerZoomAnimation: true,
          // Define limites de zoom
          minZoom: 3,
          maxZoom: 19,
          // Configurações de interatividade
          closePopupOnClick: true,
          // Ativa toque para dispositivos móveis
          tap: true,
          // Ativa clique duplo para zoom
          doubleClickZoom: true,
          // Ativa zoom com shift+clique
          boxZoom: true
        }).setView(this.COORDENADAS_PRAIA_GRANDE, this.ZOOM_PADRAO);
        
        // Configura o gerenciamento de eventos do mapa
        this.map.tap = true; // Ativa eventos touch
        
        // Remove qualquer manipulador de clique existente
        if (this.map._container && this.map._container._leaflet_events) {
          L.DomEvent.off(this.map._container, 'click');
        }
        
        console.log('Mapa criado com sucesso:', this.map);
      } catch (mapError) {
        console.error('Erro ao criar o mapa:', mapError);
        throw mapError;
      }

      console.log('Mapa criado, adicionando controles e camadas...');
      
      // Adiciona controles de zoom
      L.control.zoom({ 
        position: 'topright',
        zoomInTitle: 'Aproximar',
        zoomOutTitle: 'Afastar'
      }).addTo(this.map);

      // Adiciona camada do mapa base (CartoDB Positron)
      const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors, © CARTO',
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
        detectRetina: true
      });
      
      baseLayer.addTo(this.map);
      console.log('Camada base adicionada ao mapa');

      // Inicializa camadas
      this.markersLayer = L.layerGroup().addTo(this.map);
      
      console.log('Configurando botões de controle...');
      // Configura botões de controle
      this.addControlButtons();
      
      console.log('Carregando dados iniciais...');
      // Carrega dados iniciais
      this.carregarDados();
      
      console.log('Configurando botão de rota...');
      // Configura o botão de traçar rota
      this.configurarBotaoTraçarRota();
      
      // Adiciona evento para redimensionar o mapa quando a janela for redimensionada
      window.addEventListener('resize', () => {
        if (this.map) {
          console.log('Redimensionando mapa...');
          this.map.invalidateSize();
        }
      });
      
      console.log('Mapa inicializado com sucesso!');
      console.log('=== FIM _initMapAfterHeatLoad() ===');
      
      // Resolve a promessa com a instância do mapa
      if (resolve && typeof resolve === 'function') {
        resolve(this.map);
      }
      
      return this.map;
      
    } catch (error) {
      console.error('Erro ao inicializar mapa após carregar o heat:', error);
      
      // Mostra mensagem de erro para o usuário
      this.mostrarNotificacao('Erro ao carregar o mapa. Por favor, recarregue a página.', 'error');
      
      // Rejeita a promessa se houver um callback de rejeição
      if (reject && typeof reject === 'function') {
        reject(error);
      }
      
      throw error;
    }
  },

  // ====== Funções de Controle ======
  focarEmLocalizacao: function(coordenadas, zoom = this.ZOOM_PADRAO) {
    if (!this.map) {
      console.error('Mapa não inicializado');
      return;
    }
    
    this.map.flyTo(coordenadas, zoom, {
      animate: true,
      duration: 1.5,
      easeLinearity: 0.25,
      noMoveStart: true
    });
  },

  localizarUsuario: function() {
    return new Promise((resolve, reject) => {
      console.log('Iniciando localização do usuário...');
      
      const btnLocate = document.getElementById('locateMe');
      if (btnLocate) {
        btnLocate.disabled = true;
        btnLocate.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Localizando...';
      }

      // Verifica se a geolocalização está disponível
      if (!navigator.geolocation) {
        const errorMsg = 'Seu navegador não suporta geolocalização.';
        console.error(errorMsg);
        this.showNotification(errorMsg, 'error');
        if (btnLocate) {
          btnLocate.disabled = false;
          btnLocate.innerHTML = '<i class="fas fa-location-arrow"></i>';
        }
        reject(new Error(errorMsg));
        return;
      }

      // Mostrar mensagem de carregamento
      let loadingNotification = null;
      this.showNotification('Buscando sua localização exata...', 'info', 5000)
        .then(notification => {
          loadingNotification = notification;
        })
        .catch(err => console.error('Erro ao mostrar notificação:', err));

      // Configuração de timeout para evitar que fique carregando para sempre
      const timeoutId = setTimeout(() => {
        console.warn('Tempo de espera da localização excedido');
        if (btnLocate) {
          btnLocate.disabled = false;
          btnLocate.innerHTML = '<i class="fas fa-location-arrow"></i>';
        }
        if (loadingNotification) loadingNotification.remove();
        this.showNotification('Não foi possível obter localização precisa. Verifique as permissões do navegador.', 'warning');
        reject(new Error('Tempo de espera da localização excedido'));
      }, 25000); // 25 segundos de timeout

      // Tenta obter a localização com alta precisão
      const options = {
        enableHighAccuracy: true,  // Tenta obter a localização mais precisa possível (GPS, se disponível)
        timeout: 20000,           // Tempo máximo de espera em ms (20 segundos)
        maximumAge: 0,            // Não usar posição em cache
        requireHighAccuracy: true  // Exige alta precisão (pode demorar mais)
      };


      // Função para processar a posição obtida
      const processPosition = (position) => {
        clearTimeout(timeoutId); // Limpa o timeout
        
        try {
          const { latitude, longitude, accuracy } = position.coords;
          console.log('Localização obtida com sucesso:', { 
            latitude, 
            longitude, 
            accuracy,
            source: position.coords.altitude !== null ? 'GPS/Dispositivo' : 'Rede'
          });

          // Verifica se a precisão é aceitável (menos de 100 metros)
          if (accuracy > 100) {
            console.warn('Precisão da localização muito baixa:', accuracy, 'metros');
            this.showNotification(
              `Localização com baixa precisão (${Math.round(accuracy)}m). Posicione-se em área aberta.`, 
              'warning', 
              5000
            );
          }

          // Remove marcador anterior se existir
          if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
          }

          // Cria novo marcador com ícone personalizado
          this.userMarker = L.marker([latitude, longitude], {
            icon: L.divIcon({
              html: '<div style="background-color: #4285F4; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>',
              className: 'user-location-marker',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })
          }).addTo(this.map);

          // Adiciona um círculo de precisão
          L.circle([latitude, longitude], {
            radius: accuracy,
            stroke: false,
            fillColor: '#4285F4',
            fillOpacity: 0.15
          }).addTo(this.map);

          // Centraliza o mapa na localização com zoom baseado na precisão
          const zoomLevel = accuracy < 50 ? 17 : accuracy < 200 ? 15 : 13;
          this.map.flyTo([latitude, longitude], zoomLevel, {
            animate: true,
            duration: 1
          });

          // Atualiza o botão
          if (btnLocate) {
            btnLocate.disabled = false;
            btnLocate.innerHTML = '<i class="fas fa-location-arrow"></i>';
          }
          
          // Remove a notificação de carregamento
          if (loadingNotification) loadingNotification.remove();
          
          // Mostra notificação de sucesso com a precisão
          this.showNotification(
            `Localização encontrada! Precisão: ${Math.round(accuracy)} metros`,
            'success', 
            3000
          );
          
          // Resolve a promessa com as coordenadas
          resolve({ 
            latitude, 
            longitude, 
            accuracy,
            source: position.coords.altitude !== null ? 'gps' : 'network'
          });
          
        } catch (error) {
          console.error('Erro ao processar localização:', error);
          handleError('Erro ao processar localização');
        }
      };

      // Função para lidar com erros
      const handleError = (error, customMessage) => {
        clearTimeout(timeoutId);
        let errorMessage = customMessage || 'Não foi possível obter sua localização. ';
        
        if (error) {
          console.error('Erro de geolocalização:', error);
          
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Permissão de localização negada. Por favor, habilite a localização nas configurações do seu navegador.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Não foi possível determinar sua localização. Verifique se o GPS está ativado e tente novamente em uma área aberta.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Tempo de espera excedido. Verifique se o GPS está ativado e tente novamente em uma área aberta.';
              break;
            default:
              errorMessage = 'Ocorreu um erro inesperado ao tentar obter sua localização.';
          }
        }
        
        console.error('Detalhes do erro:', errorMessage);
        this.showNotification(errorMessage, 'error', 7000);
        
        if (btnLocate) {
          btnLocate.disabled = false;
          btnLocate.innerHTML = '<i class="fas fa-location-arrow"></i>';
        }
        
        if (loadingNotification) loadingNotification.remove();
        reject(new Error(errorMessage));
      };

      // Tenta primeiro com alta precisão (GPS)
      navigator.geolocation.getCurrentPosition(
        processPosition,
        (error) => {
          console.warn('Falha ao obter localização de alta precisão, tentando método alternativo...', error);
          
          // Se falhar, tenta com configurações menos restritivas
          navigator.geolocation.getCurrentPosition(
            processPosition,
            (secondError) => {
              handleError(secondError, 'Não foi possível obter uma localização precisa. Verifique as configurações do seu dispositivo.');
            },
            {
              enableHighAccuracy: false,  // Aceita localização por IP/WiFi
              timeout: 15000,            // 15 segundos
              maximumAge: 0
            }
          );
        },
        options
      );
    });
  },

  addControlButtons: function() {
    // Botão de focar em Praia Grande
    const btnFocus = document.getElementById('focusPraiaGrande');
    if (btnFocus) {
      btnFocus.addEventListener('click', () => {
        this.focarEmLocalizacao(this.COORDENADAS_PRAIA_GRANDE);
        this.animarBotao(btnFocus);
      });
    }

    // Botão de localização
    const btnLocate = document.getElementById('locateMe');
    if (btnLocate) {
      btnLocate.addEventListener('click', async () => {
        try {
          await this.animarBotao(btnLocate);
          await this.localizarUsuario();
        } catch (error) {
          console.error('Erro ao localizar usuário:', error);
        }
      });
    }
  },

  // ====== Funções de Utilidade ======
  animarBotao: function(botao, duracao = 1800) {
    return new Promise((resolve) => {
      try {
        if (!botao) {
          resolve();
          return;
        }
        
        botao.classList.add('animate-pulse');
        botao.disabled = true;
        
        setTimeout(() => {
          botao.classList.remove('animate-pulse');
          botao.disabled = false;
          resolve();
        }, duracao);
      } catch (error) {
        console.error('Erro em animarBotao:', error);
        resolve();
      }
    });
  },

  // ====== Gerenciamento de Dados ======
  carregarDados: async function() {
    console.log('=== INÍCIO carregarDados() ===');
    
    try {
      // Mostra indicador de carregamento
      this.showNotification('Carregando restaurantes...', 'info', 2000);
      
      // Faz a requisição para a API
      const response = await fetch('/api/pedidos_por_restaurante/');
      
      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.status || data.status !== 'ok' || !Array.isArray(data.data)) {
        throw new Error('Formato de dados inválido da API');
      }
      
      // Formata os dados para o formato esperado pelo processarDados
      const restaurantes = data.data.map(rest => ({
        id: rest._id,
        nome: rest.nome || `Restaurante ${rest._id}`,
        lat: rest.latitude || 0,
        lng: rest.longitude || 0,
        pedidos: rest.total_pedidos || 0,
        endereco: rest.bairro || 'Endereço não disponível',
        telefone: '(00) 00000-0000' // Telefone não está vindo da API
      }));
      
      console.log('Dados dos restaurantes carregados:', restaurantes);
      
      // Processa os dados recebidos
      this.processarDados({
        status: 'ok',
        data: restaurantes
      });
      
    } catch (error) {
      console.error('Erro ao carregar restaurantes:', error);
      this.showNotification('Erro ao carregar restaurantes: ' + error.message, 'error', 5000);
      
      // Tenta carregar dados de exemplo em caso de erro
      console.warn('Tentando carregar dados de exemplo...');
      this.carregarDadosExemplo();
    }
  },

  carregarDadosExemplo: function() {
    console.log('Carregando dados de exemplo...');
    
    // Dados de exemplo para usar em caso de falha na API
    const restaurantesExemplo = [
      { 
        id: 'ex1',
        nome: 'Restaurante Exemplo 1', 
        lat: -24.0167, 
        lng: -46.4667, 
        pedidos: 15,
        endereco: 'Rua Exemplo, 123',
        telefone: '(13) 99999-9999'
      },
      { 
        id: 'ex2',
        nome: 'Restaurante Exemplo 2', 
        lat: -24.0180, 
        lng: -46.4680, 
        pedidos: 8,
        endereco: 'Av. Teste, 456',
        telefone: '(13) 98888-8888'
      },
      { 
        id: 'ex3',
        nome: 'Restaurante Exemplo 3', 
        lat: -24.0150, 
        lng: -46.4650, 
        pedidos: 12,
        endereco: 'Rua Amostra, 789',
        telefone: '(13) 97777-7777'
      },
      { 
        id: 'ex4',
        nome: 'Restaurante Exemplo 4', 
        lat: -24.0200, 
        lng: -46.4700, 
        pedidos: 20,
        endereco: 'Av. Demonstração, 321',
        telefone: '(13) 96666-6666'
      },
      { 
        id: 'ex5',
        nome: 'Restaurante Exemplo 5', 
        lat: -24.0140, 
        lng: -46.4630, 
        pedidos: 5,
        endereco: 'Rua Modelo, 654',
        telefone: '(13) 95555-5555'
      }
    ];
    
    // Processa os dados de exemplo
    this.processarDados({
      status: 'ok',
      data: restaurantesExemplo
    });
    
    this.showNotification('Dados de exemplo carregados', 'warning', 3000);
  },

  processarDados: function(data) {
    console.log('=== INÍCIO processarDados() ===');
    
    try {
      if (!data || !data.status || data.status !== 'ok' || !Array.isArray(data.data)) {
        throw new Error('Dados inválidos recebidos para processamento');
      }
      
      const restaurantes = data.data;
      console.log(`${restaurantes.length} restaurantes para processar`);
      
      // Limpa marcadores existentes
      if (this.markersLayer) {
        this.markersLayer.clearLayers();
      } else {
        this.markersLayer = L.layerGroup().addTo(this.map);
      }
      
      // Filtra restaurantes com coordenadas válidas
      const restaurantesValidos = restaurantes.filter(r => {
        const lat = parseFloat(r.lat);
        const lng = parseFloat(r.lng);
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      });
      
      if (restaurantesValidos.length === 0) {
        this.showNotification('Nenhum restaurante com localização válida encontrado', 'warning', 5000);
        return;
      }
      
      // Adiciona marcadores para cada restaurante
      const markers = [];
      
      restaurantesValidos.forEach(restaurante => {
        try {
          const lat = parseFloat(restaurante.latitude || restaurante.lat);
          const lng = parseFloat(restaurante.longitude || restaurante.lng);
          
          if (isNaN(lat) || isNaN(lng)) {
            console.error('Coordenadas inválidas para o restaurante:', restaurante);
            return;
          }
          
          // Cria um marcador personalizado com o número de pedidos
          const icone = L.divIcon({
            html: `
              <div style="
                background-color: #e74c3c;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                border: 2px solid white;
                box-shadow: 0 0 10px rgba(0,0,0,0.3);
                font-size: 12px;
                pointer-events: auto;
              ">
                ${restaurante.total_pedidos || restaurante.pedidos || 0}
              </div>
            `,
            className: 'restaurante-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -15]
          });
          
          // Cria o marcador
          const marker = L.marker([lat, lng], { 
            icon: icone,
            title: restaurante.nome || 'Restaurante',
            alt: `Restaurante ${restaurante.nome || 'desconhecido'}`,
            // Importante para garantir que os eventos de clique funcionem
            interactive: true,
            bubblingMouseEvents: false
          });
          
          // Adiciona o marcador à camada
          marker.addTo(this.markersLayer);
          markers.push(marker);
          
          // Configura o evento de clique no marcador
          marker.on('click', (e) => {
            console.log('Marcador clicado:', restaurante);
            
            // Para o evento para evitar propagação
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
            
            // Exibe o modal com os detalhes do restaurante
            if (window.ModalManager && typeof window.ModalManager.mostrar === 'function') {
              // Adiciona um pequeno atraso para garantir que o clique seja processado
              setTimeout(() => {
                window.ModalManager.mostrar(restaurante);
              }, 10);
            } else {
              console.error('Erro: ModalManager não encontrado ou função mostrar não existe');
            }
            
            // Não altera mais o zoom ao clicar no marcador, apenas exibe o modal
            return false; // Evita propagação adicional
          });
          
          // Garante que o cursor mude para pointer ao passar sobre o marcador
          setTimeout(() => {
            const element = marker.getElement();
            if (element) {
              element.style.cursor = 'pointer';
              element.style.pointerEvents = 'auto';
              // Adiciona um título para acessibilidade
              element.setAttribute('title', `Ver detalhes de ${restaurante.nome || 'restaurante'}`);
            }
          }, 100);
          
        } catch (error) {
          console.error('Erro ao criar marcador:', error, restaurante);
        }
      });
      
      // Ajusta o zoom para mostrar todos os marcadores
      if (markers.length > 0) {
        const grupo = L.featureGroup(markers);
        this.map.fitBounds(grupo.getBounds().pad(0.2));
        this.showNotification(`${markers.length} restaurantes carregados com sucesso`, 'success', 3000);
      } else {
        this.showNotification('Nenhum restaurante encontrado', 'info', 3000);
      }
      
      console.log('=== FIM processarDados() ===');
      
    } catch (error) {
      console.error('Erro ao processar dados:', error);
      this.showNotification('Erro ao processar dados: ' + error.message, 'error', 5000);
    }
  },

  // ====== Gerenciamento de Rota ======
  limparRota: function() {
    if (this.rotaAtiva) {
      this.map.removeControl(this.rotaAtiva);
      this.rotaAtiva = null;
    }
    this.pontoSelecionado = null;
  },

  tracarRotaOSRM: function(origemLng, origemLat, destinoLng, destinoLat, nomeDestino) {
    return new Promise((resolve) => {
      // Implementação do roteamento OSRM
      console.log('Tracando rota OSRM...');
      resolve();
    });
  },

  // ====== Configuração do Botão de Rota ======
  configurarBotaoTraçarRota: function() {
    const btnTraceRoute = document.getElementById('btnTraceRoute');
    if (!btnTraceRoute) return;

    btnTraceRoute.addEventListener('click', () => {
      const ponto = this.pontoSelecionado;
      
      if (!ponto || !ponto.restaurantes || !Array.isArray(ponto.restaurantes) || ponto.restaurantes.length === 0) {
        return alert('Clique primeiro em um ponto de calor que tenha restaurante.');
      }

      // Pega o primeiro restaurante do ponto
      const resto = ponto.restaurantes[0];
      const lat = resto.latitude;
      const lng = resto.longitude;
      const nome = resto.nome || resto.nome_restaurante || 'Restaurante';

      // Chama a função que usa OSRM
      this.abrirRotaNoMapa(lat, lng, nome);
    });
  },

  // ====== Função para abrir rota no mapa ======
  abrirRotaNoMapa: function(lat, lng, nome) {
    // Implementação da função abrirRotaNoMapa
    console.log(`Traçando rota para ${nome} em (${lat}, ${lng})`);
    // ...
  },

  // ====== Função para exibir notificações ======
  showNotification: function(message, type = 'info', duration = 5000) {
    return new Promise((resolve) => {
      // Cria um ID único para a notificação
      const notificationId = 'notif-' + Math.random().toString(36).substr(2, 9);
      
      // Cria o elemento da notificação
      const notification = document.createElement('div');
      notification.id = notificationId;
      notification.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white transform transition-all duration-300 translate-x-0 opacity-100 ${
        type === 'error' ? 'bg-red-500' : 
        type === 'success' ? 'bg-green-500' : 
        type === 'warning' ? 'bg-yellow-500' : 
        'bg-blue-500'
      }`;
      notification.style.zIndex = '9999';
      notification.style.minWidth = '300px';
      notification.style.maxWidth = '90vw';
      notification.style.wordBreak = 'break-word';
      
      // Adiciona o ícone e a mensagem
      notification.innerHTML = `
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <i class="fas ${
              type === 'error' ? 'fa-exclamation-circle' : 
              type === 'success' ? 'fa-check-circle' : 
              type === 'warning' ? 'fa-exclamation-triangle' : 
              'fa-info-circle'
            } mr-2"></i>
          </div>
          <div class="flex-1">
            <p class="text-sm font-medium">${message}</p>
          </div>
          <button onclick="document.getElementById('${notificationId}').remove()" class="ml-2 text-white hover:text-gray-200">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
      
      // Adiciona a notificação ao corpo do documento
      document.body.appendChild(notification);
      
      // Configura o tempo de exibição
      let timeoutId;
      if (duration > 0) {
        timeoutId = setTimeout(() => {
          notification.style.transform = 'translateX(120%)';
          notification.style.opacity = '0';
          setTimeout(() => {
            if (document.body.contains(notification)) {
              document.body.removeChild(notification);
            }
          }, 300);
        }, duration);
      }
      
      // Retorna um objeto com método para remover a notificação manualmente
      resolve({
        remove: () => {
          if (timeoutId) clearTimeout(timeoutId);
          if (document.body.contains(notification)) {
            notification.style.transform = 'translateX(120%)';
            notification.style.opacity = '0';
            setTimeout(() => {
              if (document.body.contains(notification)) {
                document.body.removeChild(notification);
              }
            }, 300);
          }
        }
      });
    });
  }

};

// Exporta o objeto MapaApp para uso global
window.MapaApp = MapaApp;

// Função para inicialização do mapa (mantida para compatibilidade)
function initMap() {
  return MapaApp.initMap();
}

// Inicialização segura quando o DOM estiver pronto
function initApp() {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initializeApp();
  } else {
    document.addEventListener('DOMContentLoaded', initializeApp);
  }
}

function initializeApp() {
  // Verifica se o elemento do mapa existe
  const mapElement = document.getElementById('map');
  const mapContainer = document.getElementById('mapaRota');
  
  // Só inicializa se pelo menos um dos elementos de mapa existir
  if (!mapElement && !mapContainer) {
    console.log('Nenhum elemento de mapa encontrado no DOM');
    return;
  }

  // Inicializa o mapa apenas se o elemento #map existir
  if (mapElement) {
    MapaApp.initMap()
      .then(function() {
        console.log('Mapa principal inicializado com sucesso');
      })
      .catch(function(error) {
        console.error('Falha ao inicializar o mapa principal:', error);
        // Usa a função de notificação do MapaApp
        MapaApp.showNotification('Falha ao carregar o mapa. Por favor, recarregue a página.', 'error', 5000);
      });
  } else {
    console.log('Mapa principal (#map) não encontrado, pulando inicialização');
  }
}

// Inicializa a aplicação
initApp();
