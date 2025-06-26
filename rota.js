// static/js/rota.js

// Expor funções globalmente
window.RotaApp = (() => {
    let map = null;
    let routingControl = null;
  
    // Inicializa o mapa
    function initRotaMap() {
      return new Promise((resolve, reject) => {
        // Verificar se o container do mapa existe no DOM
        const mapContainer = document.getElementById('mapaRota');
        if (!mapContainer) {
          const error = new Error('Elemento do mapa não encontrado no DOM');
          console.error(error);
          reject(error);
          return;
        }

        try {
          // Verificar se o mapa já foi inicializado e ainda está no DOM
          if (window.mapInstance && document.body.contains(window.mapInstance.getContainer())) {
            console.log('Mapa já inicializado, reutilizando...');
            // Forçar redesenho para garantir que está visível
            setTimeout(() => {
              if (window.mapInstance) {
                window.mapInstance.invalidateSize();
              }
            }, 50);
            resolve(window.mapInstance);
            return;
          }
          
          // Se já existe um mapa, remova-o corretamente
          if (window.mapInstance) {
            try {
              window.mapInstance.off();
              window.mapInstance.remove();
            } catch (e) {
              console.warn('Erro ao remover instância anterior do mapa:', e);
            } finally {
              window.mapInstance = null;
            }
          }

          // Criar o mapa
          window.mapInstance = L.map('mapaRota', {
            zoomControl: false,
            attributionControl: false,
            zoomSnap: 0.1,
            zoomDelta: 0.5,
            wheelPxPerZoomLevel: 60,
            preferCanvas: true
          });

          // Adicionar camada do OpenStreetMap
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }).addTo(window.mapInstance);

          // Configurar controles
          L.control.zoom({
            position: 'bottomright'
          }).addTo(window.mapInstance);
          
          // Configurar o controle de escala
          L.control.scale({
            imperial: false,
            metric: true,
            position: 'bottomleft'
          }).addTo(window.mapInstance);
          
          // Configurar o controle de localização
          const locControl = L.control.locate({
            position: 'bottomright',
            drawCircle: true,
            showPopup: false,
            locateOptions: {
              enableHighAccuracy: true,
              maxZoom: 16,
              timeout: 10000,
              maximumAge: 0
            },
            icon: 'fa fa-location-arrow',
            iconLoading: 'fa fa-spinner fa-spin',
            circleStyle: {
              weight: 2,
              color: '#0078A8',
              fillColor: '#0078A8',
              fillOpacity: 0.2
            },
            markerStyle: {
              opacity: 0
            }
          }).addTo(window.mapInstance);
          
          // Iniciar localização automaticamente
          locControl.start();
          
          // Forçar um reflow do mapa
          setTimeout(() => { 
            if (window.mapInstance) {
              window.mapInstance.invalidateSize();
              // Centralizar em uma posição padrão (Brasília) como fallback
              window.mapInstance.setView([-15.7942, -47.8822], 4);
            }
          }, 100);
          
          console.log('Mapa inicializado com sucesso');
          resolve(window.mapInstance);
          
        } catch (error) {
          console.error('Erro ao inicializar o mapa:', error);
          reject(error);
        }
      });
    }
  
    // Planeja a rota entre origem e destino usando OSRM
    function planRoute(latO, lngO, latD, lngD) {
      // Instanciar tradutor de instruções em português
      let instructionsTranslator = null;
      if (typeof OSRMTextInstructions !== 'undefined') {
        instructionsTranslator = new OSRMTextInstructions('pt-BR');
      }
      console.log('Iniciando cálculo de rota de', [latO, lngO], 'para', [latD, lngD]);
      
      const loader = document.getElementById('loadingInstrucoes');
      const lista = document.getElementById('listaInstrucoes');
      const erroRota = document.getElementById('erroRota');
      
      // Limpar estado anterior
      if (loader) {
        loader.classList.remove('hidden');
        loader.style.display = 'flex';
      }
      if (lista) {
        lista.innerHTML = '';
        lista.classList.add('hidden');
      }
      if (erroRota) {
        erroRota.innerHTML = '';
        erroRota.classList.add('hidden');
      }
  
      // Remover o controle de rota anterior se existir
      if (window.routingControl) {
        try {
          window.routingControl.off();
          if (window.mapInstance) {
            window.mapInstance.removeControl(window.routingControl);
          }
          window.routingControl = null;
        } catch (e) {
          console.warn('Erro ao remover controle de rota anterior:', e);
        }
      }
      
      // Garantir que o painel de instruções esteja visível
      const painelInstrucoes = document.getElementById('painelInstrucoes');
      if (painelInstrucoes) {
        painelInstrucoes.classList.remove('hidden');
        painelInstrucoes.classList.remove('minimizado');
      }
  
      // Configurar os waypoints
      const waypoints = [
        L.latLng(latO, lngO),
        L.latLng(latD, lngD)
      ];
      
      // Configurar opções do roteamento
      const routeOptions = {
        waypoints: waypoints,
        routeWhileDragging: false,
        fitSelectedRoutes: true,
        addWaypoints: false,
        show: true,
        lineOptions: {
          styles: [{ 
            color: '#1976D2', 
            weight: 5,
            opacity: 0.8
          }]
        },
        createMarker: function(i, waypoint, n) {
          // Criar marcadores apenas para origem e destino
          if (i === 0 || i === n - 1) {
            const marker = L.marker(waypoint.latLng, {
              draggable: false,
              autoPan: true
            });
            
            // Personalizar o ícone do marcador
            const icon = L.divIcon({
              className: i === 0 ? 'marker-start' : 'marker-end',
              html: i === 0 ? '🟢' : '🔴',
              iconSize: [24, 24],
              iconAnchor: [12, 24],
              popupAnchor: [0, -24]
            });
            
            marker.setIcon(icon);
            
            // Adicionar popup com informações
            if (i === 0) {
              marker.bindPopup('Sua localização atual');
            } else {
              const endereco = document.querySelector('.rota-btn[data-lat][data-lng]')?.dataset.nome || 'Destino';
              marker.bindPopup(endereco);
            }
            
            return marker;
          }
          return null;
        },
        formatter: new L.Routing.Formatter({
          language: 'pt',
          unit: 'metric',
          roundingSensitivity: 1
        })
      };
      
      try {
        console.log('Criando controle de roteamento...');
        
        // Remover controle de rota anterior se existir
        if (window.routingControl && window.mapInstance) {
          try {
            window.mapInstance.removeControl(window.routingControl);
          } catch (e) {}
        }
        // Criar o controle de rota
        window.routingControl = L.Routing.control(routeOptions);
        
        // Adicionar o controle ao mapa
        if (window.mapInstance) {
          console.log('Adicionando controle ao mapa...');
          window.routingControl.addTo(window.mapInstance);
          // Ajustar o zoom para mostrar toda a rota
          window.mapInstance.fitBounds(L.latLngBounds(waypoints), { 
            padding: [50, 50],
            maxZoom: 15
          });
        }
        // Timeout para rota — garantir escopo local e evitar conflitos
        let routeTimeoutId = setTimeout(() => {
          console.warn('Tempo limite excedido para cálculo da rota');
          if (erroRota) {
            erroRota.innerHTML = 'O cálculo da rota está demorando mais que o esperado. Verifique sua conexão e tente novamente.';
            erroRota.classList.remove('hidden');
          }
          if (loader) loader.classList.add('hidden');
        }, 30000); // 30s

        // Configurar manipulador de rota encontrada
        window.routingControl.on('routesfound', function(e) {
          console.log('Rota encontrada:', e);
          // Limpar timeout imediatamente
          if (routeTimeoutId) { clearTimeout(routeTimeoutId); routeTimeoutId = null; }
          
          try {
            const routes = e.routes;
            if (!routes || routes.length === 0) {
              throw new Error('Nenhuma rota encontrada');
            }
            
            const summary = routes[0].summary;
            
            // Esconder loader
            if (loader) loader.classList.add('hidden');
            // Limpar timeout de rota
            if (routeTimeoutId) { clearTimeout(routeTimeoutId); routeTimeoutId = null; }
            
            // Atualizar a lista de instruções
            if (lista) {
              lista.innerHTML = '';
              
              // Adicionar resumo da rota
              const resumoDiv = document.createElement('div');
              resumoDiv.className = 'bg-blue-50 p-3 rounded-lg mb-3 border border-blue-100';
              resumoDiv.innerHTML = `
                <p class="font-semibold text-blue-800 text-sm flex items-center">
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                  </svg>
                  Resumo da Rota
                </p>
                <div class="flex justify-between mt-2 text-xs text-blue-600">
                  <span class="flex items-center">
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    ${(summary.totalDistance / 1000).toFixed(1)} km
                  </span>
                  <span class="flex items-center">
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    ${Math.ceil(summary.totalTime / 60)} min
                  </span>
                </div>
              `;
              lista.appendChild(resumoDiv);
              
              // Adicionar cada etapa da rota
              let stepNumber = 1;
              // Garantir steps reais do OSRM
              let steps = [];
              const route = e.routes[0];
              
              // Tenta obter os passos da rota de diferentes maneiras
              if (route.legs?.[0]?.steps) {
                steps = route.legs[0].steps;
              } else if (route.steps) {
                steps = route.steps;
              } else if (route.instructions) {
                // fallback para manter compatibilidade
                steps = route.instructions.map((inst, idx) => inst.step || null);
              }

              // Leitura automática da primeira instrução
              let primeiraInstrucaoLida = false;

              if (steps.length === 0) {
                lista.innerHTML = '<p class="text-red-500">Nenhuma instrução disponível.</p>';
              }

steps.forEach((step, index) => {
  const instrucao = instructionsTranslator.compile(step, {
    legIndex: 0,
    legCount: 1,
  }) || 'Instrução indisponível';

  const distancia = step.distance < 1000
    ? `${Math.round(step.distance)} m`
    : `${(step.distance / 1000).toFixed(1)} km`;

  const duracao = Math.ceil(step.duration / 60);

  const div = document.createElement('div');
  div.className = 'instrucao-item';
  div.innerHTML = `
    <p class="font-medium flex items-start">
      <span class="bg-blue-100 text-blue-800 text-xs font-semibold mr-2 px-2 py-0.5 rounded-full">
        ${index + 1}
      </span>
      <span>${instrucao}</span>
    </p>
    <p class="distancia text-gray-500 text-xs mt-1 pl-6">
      ${distancia} • ${duracao} min
    </p>
  `;

  div.addEventListener('click', () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(instrucao);
      const voices = window.speechSynthesis.getVoices();
      const vozPt = voices.find(v => v.lang === 'pt-BR') || voices.find(v => v.lang.startsWith('pt'));
      if (vozPt) utter.voice = vozPt;
      utter.lang = 'pt-BR';
      utter.rate = 1;
      window.speechSynthesis.speak(utter);
    }
  });

  lista.appendChild(div);
});

                  // Síntese de voz em português
                  if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel(); // Para fala anterior
                    const utter = new SpeechSynthesisUtterance(instructionText);
                    // Selecionar voz pt-BR se disponível
                    const voices = window.speechSynthesis.getVoices();
                    const vozPt = voices.find(v => v.lang === 'pt-BR') || voices.find(v => v.lang.startsWith('pt'));
                    if (vozPt) utter.voice = vozPt;
                    utter.lang = 'pt-BR';
                    utter.rate = 1;
                    window.speechSynthesis.speak(utter);
                  }
                });

                lista.appendChild(div);
              });
              
              lista.classList.remove('hidden');
            }
                      } catch (error) {
             console.error('Erro ao processar rota:', error);
             if (routeTimeoutId) { clearTimeout(routeTimeoutId); routeTimeoutId = null; }
             if (loader) loader.classList.add('hidden');
             if (erroRota) {
               erroRota.innerHTML = `
                <div class="bg-red-50 border-l-4 border-red-400 p-4">
                  <div class="flex">
                    <div class="flex-shrink-0">
                      <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <div class="ml-3">
                      <p class="text-sm text-red-700">
                        Ocorreu um erro ao calcular a rota. Por favor, tente novamente.
                      </p>
                    </div>
                  </div>
                </div>
              `;
              erroRota.classList.remove('hidden');
            }
          } finally {
            if (loader) loader.classList.add('hidden');
          }
        });
        
        // Configurar manipulador de erros
        window.routingControl.on('routingerror', function(error) {
          if (routeTimeoutId) { clearTimeout(routeTimeoutId); routeTimeoutId = null; }
          if (loader) loader.classList.add('hidden');
          console.error('Erro de roteamento:', error);
          
          if (erroRota) {
            let errorMessage = 'Não foi possível calcular a rota. Verifique sua conexão e tente novamente.';
            
            if (error.status === -1) {
              errorMessage = 'Não foi possível conectar ao servidor de rotas. Verifique sua conexão com a internet.';
            } else if (error.status === 404) {
              errorMessage = 'Não foi possível encontrar uma rota entre os pontos selecionados.';
            } else if (error.status === 500) {
              errorMessage = 'Ocorreu um erro no servidor de rotas. Tente novamente mais tarde.';
            }
            
            erroRota.innerHTML = `
              <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div class="ml-3">
                    <p class="text-sm text-yellow-700">
                      ${errorMessage}
                    </p>
                  </div>
                </div>
              </div>
            `;
            erroRota.classList.remove('hidden');
          }
          
          if (loader) loader.classList.add('hidden');
        });
        
        // (Removido: timeout duplicado e listener duplicado)
        
        console.log('Controle de roteamento configurado com sucesso');
        
      } catch (error) {
        console.error('Erro ao configurar rota:', error);
        
        if (erroRota) {
          erroRota.innerHTML = `
            <div class="bg-red-50 border-l-4 border-red-400 p-4">
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm text-red-700">
                    Erro ao configurar o cálculo da rota. Por favor, recarregue a página e tente novamente.
                  </p>
                </div>
              </div>
            </div>
          `;
          erroRota.classList.remove('hidden');
        }
        
        if (loader) loader.classList.add('hidden');
      }
    }
  
    // Contador de tentativas de inicialização do mapa
    let tentativasInicializacao = 0;
    const MAX_TENTATIVAS = 3;
    
    // Abre o container de rota e chama planRoute
    function openRouteTo(latD, lngD, nomeDestino = 'Destino') {
      console.log('Iniciando abertura de rota para:', { latD, lngD, nomeDestino });
      
      // Elementos da UI
      const container = document.getElementById('mapaRotaContainer');

      container.classList.remove('hidden');
      setTimeout(() => {
        if (window.map) {
          window.map.invalidateSize();
        }
      }, 300);

      const painelInstrucoes = document.getElementById('painelInstrucoes');
      const conteudoPainel = document.getElementById('conteudoPainel');
      const btnMinimizar = document.getElementById('minimizarPainel');
      const loadingElement = document.getElementById('loadingInstrucoes');
      const listaElement = document.getElementById('listaInstrucoes');
      const erroRota = document.getElementById('erroRota');
      
      // Função para mostrar mensagem de erro ou aviso
      const mostrarMensagem = (mensagem, tipo = 'erro') => {
        console.log(`[${tipo.toUpperCase()}] ${mensagem}`);
        if (!erroRota) return;
        
        const isErro = tipo === 'erro';
        const bgColor = isErro ? 'red' : 'yellow';
        const icon = isErro ? 
          '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />' :
          '<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />';
          
        erroRota.innerHTML = `
          <div class="bg-${bgColor}-50 border-l-4 border-${bgColor}-400 p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-${bgColor}-400" viewBox="0 0 20 20" fill="currentColor">
                  ${icon}
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-${bgColor}-700">
                  ${mensagem}
                </p>
              </div>
            </div>
          </div>`;
        erroRota.classList.remove('hidden');
      };
      
      // Função para limpar mensagens
      const limparMensagens = () => {
        if (erroRota) {
          erroRota.innerHTML = '';
          erroRota.classList.add('hidden');
        }
      };
      
      // Função para centralizar no destino
      const centralizarNoDestino = () => {
        if (!window.mapInstance) return;
        
        try {
          window.mapInstance.setView([latD, lngD], 15);
          
          // Remover marcador anterior se existir
          if (window.marcadorFim) {
            try {
              window.mapInstance.removeLayer(window.marcadorFim);
            } catch (e) {
              console.warn('Erro ao remover marcador anterior:', e);
            }
          }
          
          // Adicionar marcador do destino
          window.marcadorFim = L.marker([latD, lngD], {
            icon: L.divIcon({
              className: 'marker-end',
              html: '🔴',
              iconSize: [24, 24],
              iconAnchor: [12, 24]
            })
          }).addTo(window.mapInstance);
          
          console.log('Mapa centralizado no destino:', { lat: latD, lng: lngD });
        } catch (error) {
          console.error('Erro ao centralizar no destino:', error);
        }
      };
      
      // Função para exibir informações do destino
      const exibirInfoDestino = () => {
        if (!listaElement) return;
        
        listaElement.innerHTML = `
          <div class="mb-4 p-4 bg-white rounded-lg shadow">
            <h3 class="font-semibold text-lg text-gray-800 mb-2">${nomeDestino}</h3>
            <p class="text-sm text-gray-600">
              <span class="inline-block w-20">Coordenadas:</span>
              <span class="font-mono text-xs bg-gray-100 p-1 rounded">
                ${latD.toFixed(6)}, ${lngD.toFixed(6)}
              </span>
            </p>
            <p class="mt-3 text-sm text-blue-700">
              <svg class="inline-block w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Clique nas instruções para ver o trecho correspondente no mapa.
            </p>
          </div>`;
        listaElement.classList.remove('hidden');
      };
      
      try {
        // Verificar se o container do mapa existe
        if (!container) {
          const error = 'Container do mapa de rota não encontrado';
          console.error(error);
          mostrarMensagem('Erro: Container do mapa não encontrado', 'erro');
          return Promise.reject(new Error(error));
        }
        
        // Resetar a UI
        limparMensagens();
        if (loadingElement) {
          loadingElement.classList.remove('hidden');
          loadingElement.style.display = 'flex';
        }
        if (listaElement) {
          listaElement.innerHTML = '';
          listaElement.classList.add('hidden');
        }
        
        // Mostrar o container do mapa
        container.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // Configurar o painel de instruções
        if (painelInstrucoes && conteudoPainel && btnMinimizar) {
          painelInstrucoes.style.display = 'block';
          painelInstrucoes.style.zIndex = '1000';
          conteudoPainel.style.display = 'block';
          btnMinimizar.textContent = '−';
          painelInstrucoes.classList.remove('minimizado');
          painelInstrucoes.classList.remove('hidden');
        }
        
        // Inicializar o mapa se necessário
        console.log('Verificando se o mapa precisa ser inicializado...');
        const initMapPromise = window.mapInstance ? 
          Promise.resolve(window.mapInstance) : 
          initRotaMap().then(() => window.mapInstance);
        
        return initMapPromise.then((mapInstance) => {
          console.log('Mapa pronto:', !!mapInstance);
          
          // Se a geolocalização estiver disponível, obter a localização do usuário
          if (navigator.geolocation) {
            console.log('Solicitando geolocalização...');
            
            return new Promise((resolve) => {
              const geoOptions = { 
                enableHighAccuracy: true, 
                timeout: 10000, 
                maximumAge: 0 
              };
              
              const onGeolocationSuccess = (position) => {
                console.log('Geolocalização obtida com sucesso');
                try {
                  const userLat = position.coords.latitude;
                  const userLng = position.coords.longitude;
                  
                  // Se a precisão for baixa, mostrar aviso
                  if (position.coords.accuracy > 1000) {
                    mostrarMensagem(
                      `Sua localização está com baixa precisão (cerca de ${Math.round(position.coords.accuracy)}m). ` +
                      'A rota calculada pode não ser precisa.', 
                      'aviso'
                    );
                  }
                  
                  console.log('Chamando planRoute com:', { userLat, userLng, latD, lngD });
                  // Calcular a rota
                  planRoute(userLat, userLng, latD, lngD);
                  resolve();
                } catch (error) {
                  console.error('Erro ao processar localização:', error);
                  mostrarMensagem('Erro ao processar sua localização. Tente novamente.', 'erro');
                  centralizarNoDestino();
                  exibirInfoDestino();
                  resolve();
                }
              };
              
              const onGeolocationError = (error) => {
                console.warn('Erro ao obter localização:', error);
                
                // Centralizar no destino
                centralizarNoDestino();
                
                // Mostrar mensagem de erro apropriada
                let errorMessage = 'Não foi possível obter sua localização. ';
                
                switch(error.code) {
                  case error.PERMISSION_DENIED:
                    errorMessage += 'O acesso à localização foi negado. Verifique as permissões do navegador.';
                    break;
                  case error.POSITION_UNAVAILABLE:
                    errorMessage += 'As informações de localização não estão disponíveis.';
                    break;
                  case error.TIMEOUT:
                    errorMessage += 'A solicitação de localização expirou. Tente novamente.';
                    break;
                  default:
                    errorMessage += 'Verifique as configurações do seu navegador.';
                }
                
                mostrarMensagem(errorMessage, 'erro');
                exibirInfoDestino();
                resolve();
              };
              
              // Solicitar localização
              navigator.geolocation.getCurrentPosition(
                onGeolocationSuccess, 
                onGeolocationError,
                geoOptions
              );
            });
          } else {
            // Navegador não suporta geolocalização
            console.warn('Navegador não suporta geolocalização');
            
            // Centralizar no destino
            centralizarNoDestino();
            
            // Mostrar mensagem de navegador sem suporte
            mostrarMensagem('Seu navegador não suporta geolocalização ou o recurso está desativado.', 'aviso');
            exibirInfoDestino();
            
            return Promise.resolve();
          }
        });
      } catch (error) {
        console.error('Erro em openRouteTo:', error);
        mostrarMensagem('Ocorreu um erro ao abrir o mapa. Por favor, tente novamente.', 'erro');
        return Promise.reject(error);
      } finally {
        // Garantir que o loading seja escondido em caso de erro
        if (loadingElement) {
          loadingElement.classList.add('hidden');
        }
      }
    }
  
    // Função para alternar entre minimizar e maximizar o painel
    function togglePainelInstrucoes() {
      try {
        const painel = document.getElementById('painelInstrucoes');
        const conteudo = document.getElementById('conteudoPainel');
        const btnMinimizar = document.getElementById('minimizarPainel');
        
        if (!painel || !conteudo || !btnMinimizar) {
          console.warn('Elementos do painel de instruções não encontrados');
          return;
        }
        
        const isMinimized = painel.classList.contains('minimizado');
        
        if (isMinimized) {
          // Restaurar
          painel.classList.remove('minimizado');
          conteudo.style.display = 'block';
          btnMinimizar.textContent = '−';
          console.log('Painel de instruções restaurado');
        } else {
          // Minimizar
          painel.classList.add('minimizado');
          conteudo.style.display = 'none';
          btnMinimizar.textContent = '+';
          console.log('Painel de instruções minimizado');
        }
        
        // Redimensionar o mapa para se ajustar ao novo tamanho do painel
        if (window.mapInstance) {
          setTimeout(() => {
            try {
              window.mapInstance.invalidateSize({ animate: true, duration: 0.3, easeLinearity: 0.1 });
              console.log('Mapa redimensionado após alteração do painel');
            } catch (e) {
              console.error('Erro ao redimensionar o mapa:', e);
            }
          }, 150); // Aumentei o tempo para garantir que a animação do CSS termine
        }
      } catch (error) {
        console.error('Erro ao alternar painel de instruções:', error);
      }
    }
    
    // Setup de listeners após DOM carregado
    document.querySelectorAll('.rota-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const lat = parseFloat(btn.dataset.lat);
        const lng = parseFloat(btn.dataset.lng);
        const nome = btn.closest('.restaurante-card').querySelector('h3').textContent;
    
        const container = document.getElementById('mapaRotaContainer');
        container.classList.remove('hidden');
    
        // Inicializa o mapa
        window.RotaApp.initRotaMap();
    
        // Força o mapa a redesenhar após exibição
        setTimeout(() => {
          if (window.map) {
            window.map.invalidateSize();
          }
        }, 300);
    
        // Traça a rota
        window.RotaApp.openRouteTo(lat, lng, nome);
      });
    });
    
      
      // Botão de minimizar/maximizar painel
      const btnMinimizar = document.getElementById('minimizarPainel');
      if (btnMinimizar) {
        btnMinimizar.addEventListener('click', (e) => {
          e.stopPropagation();
          togglePainelInstrucoes();
        });
      }
  
      // Fechar modal de rota
      const btnFechar = document.getElementById('fecharMapaRota');
      if (btnFechar) {
        btnFechar.addEventListener('click', () => {
          // Oculta o contêiner do mapa
          const container = document.getElementById('mapaRotaContainer');
          if (container) {
            container.classList.add('hidden');
          }
      
          // Restaura o scroll do corpo da página
          document.body.style.overflow = 'auto';
      
          // Limpa o controle de rota
          if (window.routingControl) {
            try {
              window.routingControl.off();
              if (window.map) {
                window.map.removeControl(window.routingControl);
              }
              window.routingControl = null;
            } catch (e) {
              console.warn('Erro ao remover controle de rota:', e);
            }
          }
      
          // Cancela a síntese de fala ativa
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
          }
      
          // Esconde o painel de instruções, se estiver visível
          const painelInstrucoes = document.getElementById('painelInstrucoes');
          if (painelInstrucoes) {
            painelInstrucoes.classList.add('hidden');
          }
        });
      }
      
