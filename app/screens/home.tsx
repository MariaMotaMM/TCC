import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { Checkbox } from 'react-native-paper';
import AsyncStorage from "@react-native-async-storage/async-storage";

const PAGE_STEP = 20;

const TelaInicial = () => {
  const [filtroVisivel, setFiltroVisivel] = useState(false);
  const [textoPesquisa, setTextoPesquisa] = useState('');

  // dados
  const [carros, setCarros] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // filtros selecionados
  const [selectedAno, setSelectedAno] = useState<number | null>(null);
  const [selectedGrupo, setSelectedGrupo] = useState<string | null>(null);
  const [selectedMarca, setSelectedMarca] = useState<string>('');
  const [selectedMotor, setSelectedMotor] = useState<string | null>(null);
  const [selectedTransmissao, setSelectedTransmissao] = useState<string | null>(null);
  const [selectedAr, setSelectedAr] = useState<string | null>(null);
  const [selectedDirecao, setSelectedDirecao] = useState<string | null>(null);
  const [selectedCombustivel, setSelectedCombustivel] = useState<string | null>(null);

  // paginação no cliente
  const [visiveis, setVisiveis] = useState(PAGE_STEP);

  // favoritos (local)
  const [favoritos, setFavoritos] = useState<Record<string, boolean>>({});

  // buscar carros do backend (padrão)
  const buscarCarros = async () => {
    try {
      setCarregando(true);
      setErro(null);
      const resp = await fetch('http://10.0.2.2:8000/carros');
      if (!resp.ok) throw new Error(`Erro da API: ${resp.status}`);
      const json = await resp.json();
      const lista = json.carros || json || [];
      setCarros(Array.isArray(lista) ? lista : []);
      setVisiveis(PAGE_STEP);
    } catch (e) {
      console.error(e);
      setErro('Falha ao carregar os carros. Verifique sua conexão.');
    } finally {
      setCarregando(false);
    }
  };

  // buscar carros com filtro
  const buscarCarrosFiltrados = async () => {
    try {
      setCarregando(true);
      setErro(null);

      const params = new URLSearchParams();
      if (selectedAno) params.append('ano', selectedAno.toString());
      if (selectedGrupo) params.append('grupo', selectedGrupo);
      if (selectedMarca) params.append('marca', selectedMarca);
      if (selectedMotor) params.append('motor', selectedMotor);
      if (selectedTransmissao) params.append('transmissao', selectedTransmissao);
      if (selectedAr) params.append('ar_condicionado', selectedAr);
      if (selectedDirecao) params.append('direcao_assistida', selectedDirecao);
      if (selectedCombustivel) params.append('combustivel', selectedCombustivel);

      const resp = await fetch(`http://10.0.2.2:8000/filtro-carros?${params.toString()}`);
      if (!resp.ok) throw new Error(`Erro da API: ${resp.status}`);
      const json = await resp.json();
      const resultados = json.resultados || [];
      setCarros(Array.isArray(resultados) ? resultados : []);
      setVisiveis(PAGE_STEP);

      Alert.alert('Filtros aplicados', 'Os carros foram filtrados com sucesso!');
    } catch (e) {
      console.error(e);
      setErro('Falha ao aplicar filtros.');
    } finally {
      setCarregando(false);
      setFiltroVisivel(false);
    }
  };

  useEffect(() => {
    buscarCarros();
  }, []);

const getId = (item: any, fallback: number) =>
  String(item?.veiculo_id ?? item?.id ?? fallback);

const toggleFavorito = async (item: any, fallbackIndex: number) => {
  const usuarioId = await AsyncStorage.getItem("usuario_id");

  if (!usuarioId) {
    Alert.alert("Erro", "Usuário não logado.");
    return;
  }

  try {
    const resposta = await fetch(`http://10.0.2.2:8000/favoritar/${usuarioId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: String(item.codigo) }), // ✅ enviar como string
    });

    const data = await resposta.json();

    if (resposta.ok) {
      const msg = Array.isArray(data.mensagem) ? data.mensagem.join("\n") : String(data.mensagem);
      Alert.alert("Sucesso", msg);
    } else {
      const msg = Array.isArray(data.detail) ? data.detail.join("\n") : String(data.detail);
      Alert.alert("Erro", msg);
    }
  } catch (error) {
    console.error(error);
    Alert.alert("Erro", "Falha de conexão com o servidor");
  }
};


  // filtro de texto
  const carrosFiltrados = useMemo(() => {
    const t = textoPesquisa.trim().toLowerCase();
    return carros.filter((c) => {
      if (!c) return false;
      const marca = (c.marca ?? c.MARCA ?? '').toString().toLowerCase();
      const modelo = (c.modelo ?? c.MODELO ?? '').toString().toLowerCase();
      const nome = (c.nome ?? '').toString().toLowerCase();
      const ano = String(c.ano ?? c.ANO ?? '');
      if (
        t &&
        !(
          marca.includes(t) ||
          modelo.includes(t) ||
          nome.includes(t) ||
          ano.includes(t)
        )
      ) {
        return false;
      }
      return true;
    });
  }, [carros, textoPesquisa]);

  const dadosPaginados = useMemo(
    () => carrosFiltrados.slice(0, visiveis),
    [carrosFiltrados, visiveis]
  );

  const carregarMais = () => {
    if (dadosPaginados.length < carrosFiltrados.length) {
      setVisiveis((v) => v + PAGE_STEP);
    }
  };
  

  const renderizarCarro = ({ item, index }: { item: any; index: number }) => {
    if (!item) {
      return (
        <View style={estilos.cartaoCarro}>
          <Text style={{ padding: 8 }}>Dados do veículo indisponíveis</Text>
        </View>
      );
    }

    const marca = item.marca ?? item.MARCA ?? '';
    const modelo = item.modelo ?? item.MODELO ?? '';
    const ano = Math.floor(item.ano ?? item.ANO ?? '');
    const id = getId(item, index);
    const imagemUri =
  item.imagem_url && item.imagem_url.length > 0
    ? { uri: `http://10.0.2.2:8000${item.imagem_url}` } // CORRETO
    : { uri: 'https://cdn-icons-png.flaticon.com/512/744/744465.png' }; // fallback online

    const ehFavorito = !!favoritos[id];

    return (
      <View style={estilos.cartaoCarro}>
        <TouchableOpacity
          style={estilos.botaoFavorito}
          onPress={() => toggleFavorito(item, index)}
        >
          <Ionicons
            name={ehFavorito ? 'heart' : 'heart-outline'}
            size={20}
            color={ehFavorito ? '#e91e63' : '#666'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={estilos.conteudoCard}
          onPress={() =>
            router.push({
              pathname: '/detalhes/[id]',
              params: {
                id: String(id),
                carro: encodeURIComponent(JSON.stringify(item)),
              },
            })
          }
        >
          <Image source={imagemUri} style={estilos.imagemCarro} />
          <Text style={estilos.nomeCarro}>
            {marca} {modelo}
          </Text>
          <Text style={estilos.precoCarro}>Ano: {ano}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const fecharModal = () => setFiltroVisivel(false);

  return (
    <View style={estilos.container}>
      <Text style={estilos.tituloSecao}>Pesquisar</Text>

      <View style={estilos.containerPesquisaFiltro}>
        <View style={estilos.containerPesquisa}>
          <Ionicons name="search" size={20} color="#888" style={estilos.iconePesquisa} />
          <TextInput
            style={estilos.inputPesquisa}
            placeholder="Buscar carro..."
            placeholderTextColor="#888"
            value={textoPesquisa}
            onChangeText={(txt) => {
              setTextoPesquisa(txt);
              setVisiveis(PAGE_STEP);
            }}
          />
        </View>

        <TouchableOpacity
          style={estilos.botaoFiltroIcone}
          onPress={() => setFiltroVisivel(true)}
        >
          <Ionicons name="filter" size={24} color="#2196F3" />
        </TouchableOpacity>
      </View>

      {carregando ? (
        <View style={estilos.centralizar}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={estilos.textoCarregando}>Carregando carros...</Text>
        </View>
      ) : erro ? (
        <View style={estilos.centralizar}>
          <Text style={estilos.textoErro}>{erro}</Text>
        </View>
      ) : (
        <FlatList
          data={dadosPaginados}
          renderItem={renderizarCarro}
          keyExtractor={(item, index) => getId(item, index)}
          numColumns={2}
          contentContainerStyle={estilos.conteudoFlatList}
          ListEmptyComponent={<Text style={estilos.textoVazio}>Nenhum carro encontrado.</Text>}
          onEndReached={carregarMais}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            dadosPaginados.length < carrosFiltrados.length ? (
              <ActivityIndicator size="small" color="#2196F3" style={{ margin: 16 }} />
            ) : null
          }
        />
      )}

      {/* Modal de filtros */}
      <Modal visible={filtroVisivel} animationType="slide" transparent>
        <View style={estilos.sobreposicaoModal}>
          <View style={estilos.conteudoModal}>
            <TouchableOpacity style={estilos.botaoFechar} onPress={fecharModal}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>

            <Text style={estilos.tituloModal}>Filtros</Text>

            <ScrollView style={estilos.scrollFiltros}>
              {/* Ano */}
              <View style={estilos.secaoFiltro}>
                <Text style={estilos.labelFiltro}>Ano</Text>
                <View style={estilos.pickerContainer}>
                  <Picker selectedValue={selectedAno} onValueChange={setSelectedAno}>
                    <Picker.Item label="Todos os anos" value={null} />
                    {Array.from({ length: 2025 - 2013 + 1 }, (_, i) => 2013 + i).map((ano) => (
                      <Picker.Item key={ano} label={String(ano)} value={ano} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Grupo */}
              <View style={estilos.secaoFiltro}>
                <Text style={estilos.labelFiltro}>Grupo</Text>
                {['Pequeno', 'Médio – Grande', 'Utilitário', 'Trabalho', 'Luxo'].map((grupo) => (
                  <View key={grupo} style={estilos.checkboxLinha}>
                    <Checkbox
                      status={selectedGrupo === grupo ? 'checked' : 'unchecked'}
                      onPress={() =>
                        setSelectedGrupo(selectedGrupo === grupo ? null : grupo)
                      }
                    />
                    <Text style={estilos.textoCheckbox}>{grupo}</Text>
                  </View>
                ))}
              </View>

              {/* Marca */}
              <View style={estilos.secaoFiltro}>
                <Text style={estilos.labelFiltro}>Marca</Text>
                <TextInput
                  style={estilos.inputPesquisa}
                  placeholder="Digite a marca"
                  placeholderTextColor="#888"
                  value={selectedMarca}
                  onChangeText={setSelectedMarca}
                />
              </View>

              {/* Motor */}
              <View style={estilos.secaoFiltro}>
                <Text style={estilos.labelFiltro}>Motor</Text>
                {['A', 'B', 'C', 'D', 'E'].map((motor) => (
                  <View key={motor} style={estilos.checkboxLinha}>
                    <Checkbox
                      status={selectedMotor === motor ? 'checked' : 'unchecked'}
                      onPress={() =>
                        setSelectedMotor(selectedMotor === motor ? null : motor)
                      }
                    />
                    <Text style={estilos.textoCheckbox}>{motor}</Text>
                  </View>
                ))}
              </View>

              {/* Transmissão */}
              <View style={estilos.secaoFiltro}>
                <Text style={estilos.labelFiltro}>Transmissão</Text>
                {['Automática', 'Semiautomática', 'Manual'].map((trans) => (
                  <View key={trans} style={estilos.checkboxLinha}>
                    <Checkbox
                      status={selectedTransmissao === trans ? 'checked' : 'unchecked'}
                      onPress={() =>
                        setSelectedTransmissao(selectedTransmissao === trans ? null : trans)
                      }
                    />
                    <Text style={estilos.textoCheckbox}>{trans}</Text>
                  </View>
                ))}
              </View>

              {/* Ar-condicionado */}
              <View style={estilos.secaoFiltro}>
                <Text style={estilos.labelFiltro}>Ar-condicionado</Text>
                {['S', 'N'].map((ar) => (
                  <View key={ar} style={estilos.checkboxLinha}>
                    <Checkbox
                      status={selectedAr === ar ? 'checked' : 'unchecked'}
                      onPress={() => setSelectedAr(selectedAr === ar ? null : ar)}
                    />
                    <Text style={estilos.textoCheckbox}>{ar}</Text>
                  </View>
                ))}
              </View>

              {/* Direção assistida */}
              <View style={estilos.secaoFiltro}>
                <Text style={estilos.labelFiltro}>Direção assistida</Text>
                {['H', 'E', 'H-E', 'M'].map((dir) => (
                  <View key={dir} style={estilos.checkboxLinha}>
                    <Checkbox
                      status={selectedDirecao === dir ? 'checked' : 'unchecked'}
                      onPress={() =>
                        setSelectedDirecao(selectedDirecao === dir ? null : dir)
                      }
                    />
                    <Text style={estilos.textoCheckbox}>{dir}</Text>
                  </View>
                ))}
              </View>

              {/* Combustível */}
              <View style={estilos.secaoFiltro}>
                <Text style={estilos.labelFiltro}>Combustível</Text>
                {['Gasolina', 'Etanol', 'Diesel', 'Flex'].map((comb) => (
                  <View key={comb} style={estilos.checkboxLinha}>
                    <Checkbox
                      status={selectedCombustivel === comb ? 'checked' : 'unchecked'}
                      onPress={() =>
                        setSelectedCombustivel(selectedCombustivel === comb ? null : comb)
                      }
                    />
                    <Text style={estilos.textoCheckbox}>{comb}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[estilos.botaoAplicar, { flex: 1, backgroundColor: '#eee' }]}
                onPress={() => {
                  setSelectedAno(null);
                  setSelectedGrupo(null);
                  setSelectedMarca('');
                  setSelectedMotor(null);
                  setSelectedTransmissao(null);
                  setSelectedAr(null);
                  setSelectedDirecao(null);
                  setSelectedCombustivel(null);
                  buscarCarros(); // recarrega lista padrão
                  Alert.alert('Filtros limpos', 'Todos os filtros foram removidos.');
                  setFiltroVisivel(false);
                }}
              >
                <Text style={[estilos.textoBotao, { color: '#000' }]}>Limpar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[estilos.botaoAplicar, { flex: 1 }]}
                onPress={buscarCarrosFiltrados}
              >
                <Text style={estilos.textoBotao}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Barra de navegação */}
      <View style={estilos.barraNavegacao}>
        <TouchableOpacity
          style={estilos.iconeNavegacao}
          onPress={() => router.push('/screens/home')}
        >
          <Ionicons name="home" size={24} color="#2196F3" />
          <Text style={estilos.textoNavegacaoAtivo}>Início</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={estilos.iconeNavegacao}
          onPress={() => router.push('/screens/telafavoritos')}
        >
          <Ionicons name="heart" size={24} color="#888" />
          <Text style={estilos.textoNavegacao}>Favoritos</Text>
        </TouchableOpacity>

        <TouchableOpacity style={estilos.iconeNavegacao}>
          <Ionicons name="person" size={24} color="#888" />
          <Text style={estilos.textoNavegacao}>Perfil</Text>
        </TouchableOpacity>

        <TouchableOpacity style={estilos.iconeNavegacao}>
          <Ionicons name="settings" size={24} color="#888" />
          <Text style={estilos.textoNavegacao}>Config.</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};


// --- estilos mantidos do seu código original ---
const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: 16, paddingBottom: 100 },
  tituloSecao: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#000' },
  containerPesquisaFiltro: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  containerPesquisa: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 12, height: 48 },
  iconePesquisa: { marginRight: 8 },
  inputPesquisa: { flex: 1, fontSize: 16, color: '#000', paddingVertical: 0 },
  botaoFiltroIcone: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#e3f2fd', justifyContent: 'center', alignItems: 'center' },
  conteudoFlatList: { paddingBottom: 120 },
  cartaoCarro: { width: '45%', margin: '2.5%', backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, position: 'relative' },
  botaoFavorito: { position: 'absolute', top: 8, right: 8, zIndex: 1, padding: 6, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12 },
  conteudoCard: { flex: 1 },
  imagemCarro: { width: '100%', height: 100 },
  nomeCarro: { padding: 8, fontSize: 14, fontWeight: 'bold', color: '#000' },
  precoCarro: { paddingHorizontal: 8, paddingBottom: 8, fontSize: 14, color: '#2196F3' },
  centralizar: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  textoCarregando: { marginTop: 10, fontSize: 16, color: '#666' },
  textoErro: { fontSize: 16, color: '#f44336', textAlign: 'center', marginBottom: 10 },
  textoVazio: { textAlign: 'center', marginTop: 20, fontSize: 16, color: '#999' },
  sobreposicaoModal: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  conteudoModal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  botaoFechar: { alignSelf: 'flex-end', marginBottom: 10 },
  tituloModal: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: '#000' },
  secaoFiltro: { marginBottom: 16 },
  labelFiltro: { fontWeight: '600', marginBottom: 8, color: '#000' },
  pickerContainer: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' },
  picker: { height: 50, width: '100%' },
  checkboxLinha: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  textoCheckbox: { marginLeft: 10, fontSize: 16, color: '#000' },
  botaoAplicar: { backgroundColor: '#2196F3', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  scrollFiltros: { maxHeight: 400, marginBottom: 16 },
  barraNavegacao: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingVertical: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  iconeNavegacao: { alignItems: 'center', flex: 1 },
  textoNavegacao: { fontSize: 12, color: '#888', marginTop: 4 },
  textoNavegacaoAtivo: { fontSize: 12, color: '#2196F3', fontWeight: 'bold', marginTop: 4 },
  textoBotao: { 
  color: '#fff',  // define a cor desejada do texto
  fontSize: 16,
  fontWeight: 'bold',
  textAlign: 'center',
},

});

export default TelaInicial;
