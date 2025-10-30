import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const DetalhesCarro = () => {
  const { id, carro: carroParam } = useLocalSearchParams<{ id?: string; carro?: string }>();
  const router = useRouter();

  const [carro, setCarro] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        setCarregando(true);
        setErro(null);

        if (carroParam) {
          try {
            const parsed = JSON.parse(decodeURIComponent(String(carroParam)));

            // 🔄 Normaliza as chaves do objeto (tudo para minúsculas)
            const normalizado = Object.keys(parsed).reduce((acc: any, key: string) => {
              acc[key.toLowerCase()] = parsed[key];
              return acc;
            }, {});

            setCarro(normalizado);
            return;
          } catch (e) {
            console.warn('Falha ao parsear carro dos params:', e);
          }
        }


        if (id) {
          const resp = await fetch(`http://10.0.2.2:8000/carros/${id}`);
          if (!resp.ok) throw new Error(`Erro: ${resp.status}`);
          const json = await resp.json();
          setCarro(json);
        } else {
          setErro('Carro não encontrado.');
        }
      } catch (e) {
        console.error(e);
        setErro('Não foi possível carregar os detalhes do carro.');
      } finally {
        setCarregando(false);
      }
    };
    init();
  }, [id, carroParam]);

  if (carregando) {
    return (
      <View style={estilos.container}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={estilos.textoCarregando}>Carregando detalhes...</Text>
      </View>
    );
  }

  if (erro || !carro) {
    return (
      <View style={estilos.container}>
        <Text style={estilos.textoErro}>{erro || 'Carro não encontrado.'}</Text>
        <TouchableOpacity style={estilos.botaoVoltar} onPress={() => router.back()}>
          <Text style={estilos.textoBotao}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ✅ Normalização dos campos com base no backend
  const campos = {
    ano: carro['ano'] ? parseInt(carro['ano']) : 'N/A',
    categoria: carro['categoria'] ?? 'N/A',
    marca: carro['marca'] ?? 'N/A',
    modelo: carro['modelo'] ?? 'N/A',
    versao: carro['versao'] ?? 'N/A',
    motor: carro['motor'] ?? 'N/A',
    transmissao: carro['transmissao'] ?? 'N/A',
    arCondicionado: carro['ar-condicionado'] ?? 'N/A',
    direcaoAssistida: carro['direçao assistida'] ?? 'N/A',
    combustivel: carro['combustivel'] ?? carro['combustível'] ?? 'N/A', // ✅ Correção do combustível
    nmhc: carro['emissão de nmhc (g/km)'] ?? 'N/A',
    co: carro['emissão de co (g/km)'] ?? 'N/A',
    nox: carro['emissão de nox (g/km)'] ?? 'N/A',
    co2Etanol: carro['emissão de co2 (gás efeito estufa) a produzido pela combustão do etanol (g/km)'] ?? 'N/A',
    co2Gasolina: carro['emissão de co2 (gás efeito estufa) a produzido pela combustão da gasolina ou diesel  (g/km)'] ?? 'N/A',
    rendEtanolCidade: carro['rendimento do etanol na cidade (km/l)'] ?? 'N/A',
    rendEtanolEstrada: carro['rendimento do etanol na estrada (km/l)'] ?? 'N/A',
    rendGasCidade: carro['rendimento da gasolina ou diesel na cidade (km/l)'] ?? 'N/A',
    rendGasEstrada: carro['rendimento da gasolina ou diesel estrada (km/l)'] ?? 'N/A',
    consumoEnergetico: carro['consumo energético (mj/km)'] ?? 'N/A',
    imagem: carro['imagem'] ?? 'https://cdn-icons-png.flaticon.com/512/744/744465.png',
  };

  // Traduções
  const traduzirDirecao = (valor: string) => {
    switch (valor?.toUpperCase()) {
      case 'H': return 'Hidráulica';
      case 'E': return 'Elétrica';
      case 'H-E': return 'Eletro-hidráulica';
      case 'M': return 'Mecânica';
      default: return valor || 'N/A';
    }
  };

  const traduzirCombustivel = (valor: string) => {
    switch (valor?.toUpperCase()) {
      case 'G': return 'Gasolina';
      case 'E': return 'Etanol';
      case 'D': return 'Diesel';
      case 'F': return 'Flex';
      default: return valor || 'N/A';
    }
  };

  return (
    <ScrollView style={estilos.container}>
      <View style={estilos.barraSuperior}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={estilos.tituloBarra}>Detalhes do Veículo</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={estilos.imagemContainer}>
        <Image source={{ uri: campos.imagem }} style={estilos.imagemGrande} />
        <TouchableOpacity style={estilos.botaoFavorito} onPress={() => {
          // Aqui você pode adicionar lógica para favoritar/desfavoritar a aproveita 
          // e ja fazer a logica para quando adiconar no favorito ele ficar marcado 
          console.log('Alternar favorito');
        }}>
          <Ionicons name="heart" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={estilos.infoPrincipal}>
        <Text style={estilos.nomeCarro}>{campos.marca} {campos.modelo}</Text>
        <Text style={estilos.subtituloCarro}>Categoria: {campos.categoria}</Text>
      </View>

      <View style={estilos.secaoDetalhes}>
        <Text style={estilos.tituloSecao}>Especificações Técnicas</Text>

        <View style={estilos.linhaDetalhe}><Text style={estilos.rotulo}>Ano:</Text><Text style={estilos.valor}>{campos.ano}</Text></View>
        <View style={estilos.linhaDetalhe}><Text style={estilos.rotulo}>Motor:</Text><Text style={estilos.valor}>{campos.motor}</Text></View>
        <View style={estilos.linhaDetalhe}><Text style={estilos.rotulo}>Transmissão:</Text><Text style={estilos.valor}>{campos.transmissao}</Text></View>
        <View style={estilos.linhaDetalhe}><Text style={estilos.rotulo}>Ar-condicionado:</Text><Text style={estilos.valor}>{campos.arCondicionado}</Text></View>
        <View style={estilos.linhaDetalhe}><Text style={estilos.rotulo}>Direção assistida:</Text><Text style={estilos.valor}>{traduzirDirecao(campos.direcaoAssistida)}</Text></View>
        <View style={estilos.linhaDetalhe}><Text style={estilos.rotulo}>Combustível:</Text><Text style={estilos.valor}>{traduzirCombustivel(campos.combustivel)}</Text></View>
      </View>

      <View style={estilos.secaoSustentabilidade}>
        <Text style={estilos.tituloSecao}>Índice de Sustentabilidade</Text>

        {Object.entries({
          nmhc: campos.nmhc,
          co: campos.co,
          nox: campos.nox,
          co2Etanol: campos.co2Etanol,
          co2Gasolina: campos.co2Gasolina,
          rendEtanolCidade: campos.rendEtanolCidade,
          rendEtanolEstrada: campos.rendEtanolEstrada,
          rendGasCidade: campos.rendGasCidade,
          rendGasEstrada: campos.rendGasEstrada,
          consumoEnergetico: campos.consumoEnergetico,
        }).map(([rotulo, valor]) => (
          <View key={rotulo} style={estilos.linhaDetalhe}>
            <Text style={estilos.rotulo}>{rotulo.replace(/([A-Z])/g, ' $1')}</Text>
            <Text style={estilos.valor}>{valor}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8', padding: 16 },
  barraSuperior: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, backgroundColor: '#fff', marginBottom: 16 },
  tituloBarra: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  imagemGrande: { width: '100%', height: 200, borderRadius: 12, marginBottom: 16 },
  infoPrincipal: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16 },
  nomeCarro: { fontSize: 20, fontWeight: 'bold', color: '#000', marginBottom: 4 },
  subtituloCarro: { fontSize: 16, color: '#666' },

  imagemContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  botaoFavorito: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 6,
    zIndex: 1,
  },

  secaoDetalhes: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginTop: 16 },
  tituloSecao: { fontSize: 18, fontWeight: 'bold', color: '#000', marginBottom: 12 },
  linhaDetalhe: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  rotulo: { color: '#666', fontSize: 15 },
  valor: { color: '#000', fontSize: 15, fontWeight: '500' },

  secaoSustentabilidade: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginTop: 16 },

  textoCarregando: { textAlign: 'center', marginTop: 20, fontSize: 16, color: '#666' },
  textoErro: { textAlign: 'center', marginTop: 20, fontSize: 16, color: '#f44336' },
  botaoVoltar: { backgroundColor: '#2196F3', padding: 12, borderRadius: 8, marginTop: 20, alignSelf: 'center' },
  textoBotao: { color: '#fff', fontWeight: 'bold' },

});

export default DetalhesCarro;

