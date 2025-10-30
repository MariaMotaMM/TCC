 # backend/main.py
from fastapi import FastAPI, Depends, HTTPException, Query,Body
from sqlalchemy.orm import Session
from backend import modelo as models
from backend import esquemas as schemas
from backend.database import Base, engine, SessionLocal
import pandas as pd
import numpy as np
from rapidfuzz import fuzz, process
import os
from typing import Optional
from backend.modelo import Combustivel, Consumo, Emissao, Favorito,Veiculo
import requests
import re
import random
import string
import smtplib
from email.mime.text import MIMEText
from passlib.hash import bcrypt
from backend.esquemas import UsuarioCreate, UsuarioLogin,UsuarioUpdate
from backend.esquemas import EmailRequest
from backend.modelo import Usuario
from fastapi.staticfiles import StaticFiles



# cria tabelas (se ainda não criadas)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="SMVBR API")

# ---------- Dependência DB ----------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------- Rotas de usuário (suas já existentes) ----------

DOMINIOS_PUBLICOS = [
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "icloud.com", "uol.com.br", "bol.com.br"
]

EMAIL_REGEX = r"^[\w\.-]+@[\w\.-]+\.\w+$"

app = FastAPI()

@app.post("/cadastro", response_model=schemas.UsuarioResponse)
def cadastro(usuario: schemas.UsuarioCreate, db: Session = Depends(get_db)):
    # 1️⃣ Validar formato do e-mail via regex (extra)
    if not re.match(EMAIL_REGEX, usuario.email):
        raise HTTPException(status_code=400, detail="Formato de e-mail inválido")

    # 2️⃣ Verificar se o e-mail já está cadastrado
    existe = db.query(models.Usuario).filter(models.Usuario.email == usuario.email).first()
    if existe:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    # 3️⃣ Verificação via API externa para domínios públicos
    dominio = usuario.email.split("@")[-1].lower()
    if dominio in DOMINIOS_PUBLICOS:
        api_url = f"https://rapid-email-verifier.fly.dev/api/verify?email={usuario.email}"
        try:
            response = requests.get(api_url, timeout=5)
            response.raise_for_status()
            data = response.json()
            if not data.get("valid", True):
                raise HTTPException(status_code=400, detail="E-mail inválido ou inexistente")
        except (requests.RequestException, ValueError):
            print(f"⚠️ Falha na API de verificação para {usuario.email}. Cadastro continuará.")

    # 4️⃣ Criar e salvar o novo usuário
    novo = models.Usuario(
        nome=usuario.nome,
        email=usuario.email,
        senha=usuario.senha
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)

    return novo

    
@app.post("/login")
def login(usuario: schemas.UsuarioLogin, db: Session = Depends(get_db)):
    user = db.query(models.Usuario).filter(models.Usuario.email == usuario.email).first()
    if not user or user.senha != usuario.senha:
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    # Retorna o id e o nome do usuário para uso no app
    return {
        "usuario_id": user.usuario_id,
        "nome": user.nome,
        "email": user.email,
        "message": f"Bem-vindo {user.nome}!"
    }


@app.get("/usuarios", response_model=list[schemas.UsuarioResponse])
def listar_usuarios(db: Session = Depends(get_db)):
    usuarios = db.query(models.Usuario).all()
    return usuarios


#---Visualizar o usuario----
@app.get("/usuario/{usuario_id}", response_model=schemas.UsuarioResponse)
def visualizar_usuario(usuario_id: int, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.usuario_id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    return usuario


@app.put("/usuario")
def atualizar_usuario_logado(
    usuario_id: int = Body(..., embed=True),       # ID enviado pelo frontend
    dados: schemas.UsuarioUpdate = Body(...),     # Dados novos (nome e/ou senha)
    db: Session = Depends(get_db)
):
    # Busca usuário pelo ID
    usuario = db.query(models.Usuario).filter(models.Usuario.usuario_id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Atualiza nome se fornecido
    if dados.nome is not None and dados.nome.strip() != "":
        usuario.nome = dados.nome.strip()

    # Atualiza senha se fornecido
    if dados.senha is not None and dados.senha.strip() != "":
        usuario.senha = dados.senha.strip()  # ou bcrypt.hash(dados.senha) para segurança

    db.commit()
    db.refresh(usuario)
    return {"usuario_id": usuario.usuario_id, "nome": usuario.nome, "email": usuario.email}

#--- para deletra usuario----
@app.delete("/usuario")
def deletar_usuario_logado(
    usuario_id: int = Body(..., embed=True),   # ID enviado pelo frontend
    db: Session = Depends(get_db)
):
    usuario = db.query(models.Usuario).filter(models.Usuario.usuario_id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    db.delete(usuario)
    db.commit()
    return {"detail": "Seu usuário foi deletado com sucesso"}



# ---------- Funções utilitárias ----------
def gerar_senha(tamanho=8):
    caracteres = string.ascii_letters + string.digits
    return ''.join(random.choice(caracteres) for _ in range(tamanho))


def enviar_email(destinatario: str, senha_nova: str):
    """
    Envia e-mail real se for Gmail. Para outros domínios, apenas simula.
    """
    remetente = "seuemail@gmail.com"  # seu e-mail Gmail real
    senha_email = "ukbe prlx dzrp evzw"      # senha do app do Gmail

    assunto = "Recuperação de senha"
    corpo = f"""
Olá,

Você solicitou a recuperação da sua senha. Sua nova senha temporária é:

{senha_nova}

Recomendamos que você altere sua senha após o login.

Atenciosamente,
Sua Equipe
"""

    msg = MIMEText(corpo)
    msg["Subject"] = assunto
    msg["From"] = remetente
    msg["To"] = destinatario

    try:
        # Se for Gmail, envia de verdade
        if remetente.endswith("@gmail.com"):
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login(remetente, senha_email)
                server.sendmail(remetente, destinatario, msg.as_string())
            print(f"E-mail REAL enviado para {destinatario} ✅")
        else:
            # Para outros domínios, apenas simula
            print(f"[SIMULAÇÃO] E-mail enviado para {destinatario}:\n{corpo}")
    except Exception as e:
        # Se houver erro, apenas simula e não quebra
        print(f"Erro ao enviar e-mail para {destinatario}: {e}")
        print(f"[SIMULAÇÃO] E-mail que não foi enviado:\n{corpo}")


# ---------- Endpoint de recuperação de senha ----------
@app.post("/recuperar-senha")
def recuperar_senha(dados: EmailRequest, db: Session = Depends(get_db)):
    email = dados.email

    # Buscar usuário
    usuario = db.query(Usuario).filter(Usuario.email == email).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="E-mail não cadastrado")

    # Gerar nova senha
    senha_nova = gerar_senha(10)
    usuario.senha = senha_nova  # sem bcrypt
    db.commit()

    # Enviar ou simular envio de e-mail
    enviar_email(email, senha_nova)

    return {
        "detail": f"Uma nova senha foi gerada para {email}. Verifique seu e-mail (ou console, se simulado)."
    }



ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
images_path = os.path.join(ROOT_DIR, "data", "image")

app.mount("/imgs", StaticFiles(directory=images_path), name="imgs")

# ---------- Função utilitária ----------
def find_col_insensitive(df: pd.DataFrame, candidates):
    """Retorna o nome da primeira coluna do df que contenha qualquer candidato (ignora maiúsculas e espaços)."""
    cols = list(df.columns)
    cols_norm = {c.replace(" ", "").lower(): c for c in cols}
    for cand in candidates:
        key = cand.replace(" ", "").lower()
        for k, orig in cols_norm.items():
            if key in k:
                return orig
    return None


@app.get("/filtro-carros")
def filtro_carros(
    ano: Optional[int] = Query(None),
    grupo: Optional[str] = Query(None),
    marca: Optional[str] = Query(None),
    motor: Optional[str] = Query(None),
    transmissao: Optional[str] = Query(None),
    ar_condicionado: Optional[str] = Query(None),
    direcao_assistida: Optional[str] = Query(None),
    combustivel: Optional[str] = Query(None),
    pagina: int = Query(1, ge=1),
    limite: int = Query(20, ge=1, le=200)
):
    ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    caminho = os.path.join(ROOT_DIR, "data", "database.xlsx")

    if not os.path.exists(caminho):
        raise HTTPException(status_code=404, detail="Arquivo da planilha não encontrado")

    try:
        df = pd.read_excel(caminho)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao abrir planilha: {e}")

    df.columns = [c.strip() for c in df.columns]
    df_work = df.copy()

    # -------- Aplicar filtros --------
    if ano is not None:
        col = find_col_insensitive(df_work, ["ANO", "Ano", "ano"])
        if col:
            df_work = df_work[pd.to_numeric(df_work[col], errors="coerce") == int(ano)]

    if grupo:
        col = find_col_insensitive(df_work, ["GRUPO", "Grupo"])
        if col:
            df_work = df_work[df_work[col].astype(str).str.lower().str.contains(grupo.lower(), na=False)]

    if marca:
        col = find_col_insensitive(df_work, ["MARCA", "Marca"])
        if col:
            df_work = df_work[df_work[col].astype(str).str.lower().str.contains(marca.lower(), na=False)]

    if motor:
        col = find_col_insensitive(df_work, ["FAIXA", "Faixa"])
        if col:
            df_work = df_work[df_work[col].astype(str).str.lower().str.contains(motor.lower(), na=False)]

    if transmissao:
        col = find_col_insensitive(df_work, ["CÂMBIO" "Câmbio"])
        if col:
            df_work = df_work[df_work[col].astype(str).str.lower().str.contains(transmissao.lower(), na=False)]

    if ar_condicionado:
        col = find_col_insensitive(df_work, ["AR-CONDICIONADO", "Ar-Condicionado", "AR CONDICIONADO"])
        if col:
            df_work = df_work[df_work[col].astype(str).str.lower().str.contains(ar_condicionado.lower(), na=False)]

    if direcao_assistida:
        col = find_col_insensitive(df_work, ["DIRECAO ASSISTIDA", "Direção Assistida"])
        if col:
            df_work = df_work[df_work[col].astype(str).str.lower().str.contains(direcao_assistida.lower(), na=False)]

    if combustivel:
        col = find_col_insensitive(df_work, ["COMBUSTÍVEL", "Combustivel", "Combustível"])
        if col:
            df_work = df_work[df_work[col].astype(str).str.lower().str.contains(combustivel.lower(), na=False)]

    # -------- Ordenar por Ranking (do maior para o menor) --------
    col_ranking = find_col_insensitive(df_work, ["Pontuação Final"])
    if col_ranking:
        df_work[col_ranking] = pd.to_numeric(df_work[col_ranking], errors="coerce")
        df_work = df_work.sort_values(by=col_ranking, ascending=False)

    # -------- Paginação --------
    total = len(df_work)
    inicio = (pagina - 1) * limite
    fim = inicio + limite
    page = df_work.iloc[inicio:fim]

    # -------- Converter para JSON seguro --------
    def df_to_json_safe(df_in):
        dfj = df_in.replace({np.nan: None, np.inf: None, -np.inf: None})
        return dfj.to_dict(orient="records")

    resultados = df_to_json_safe(page)


    return {"total": total, "pagina": pagina, "limite": limite, "resultados": resultados}


def adicionar_imagem(df_in):
    col_img = None
    for c in df_in.columns:
        if "imagem" in c.lower() or "foto" in c.lower():
            col_img = c
            break

    resultados = pandas_to_json_safe(df_in)

    if col_img:
        for item in resultados:
            filename = item.get(col_img)
            if filename:
                item["imagem_url"] = f"/imgs/{filename}"  # URL dinâmica
            else:
                item["imagem_url"] = None
    return resultados

# -------------------------
# Função auxiliar
# -------------------------
def pandas_to_json_safe(df: pd.DataFrame):
    """Converte um DataFrame do Pandas para lista de dicionários pronta para JSON"""
    df = df.replace({np.nan: None, np.inf: None, -np.inf: None})
    if "nota sobre os dados faltantes" in df.columns:
        df = df.drop(columns=["nota sobre os dados faltantes"])

    for col in df.select_dtypes(include=["datetime64[ns]", "datetime64[ns, UTC]"]).columns:
        df[col] = df[col].apply(lambda x: x.isoformat() if x is not None else None)

    return df.to_dict(orient="records")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
img_path = os.path.join(ROOT_DIR, "data", "image")
app.mount("/imgs", StaticFiles(directory=img_path), name="imgs")

#Consulta carros na planilha (versão simplificada e #otimizada)
#-------------------------
@app.get("/carros")
def listar_carros(busca: str = Query(None, description="Pesquisar por marca, modelo ou ano")):
    caminho = os.path.join(ROOT_DIR, "data", "dados convertidos.xlsx")

    if not os.path.exists(caminho):
        raise HTTPException(status_code=404, detail="Arquivo da planilha não encontrado")

    try:
        df = pd.read_excel(caminho)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao carregar a planilha: {str(e)}")

    # Normaliza colunas
    df.columns = [c.strip().lower() for c in df.columns]
    for col in ["marca", "modelo", "ano", "codigo"]:
        if col not in df.columns:
            raise HTTPException(status_code=500, detail=f"Coluna '{col}' ausente na planilha")
        df[col] = df[col].fillna("").astype(str).str.strip().str.upper()

    # Se não tem busca, retorna tudo
    if not busca:
        return {"carros": adicionar_imagem(df), "total": len(df)}

    # Busca direta
    termos = busca.strip().upper().split()
    df_filtrado = df.copy()
    for termo in termos:
        df_filtrado = df_filtrado[
            df_filtrado["marca"].str.contains(termo, na=False) |
            df_filtrado["modelo"].str.contains(termo, na=False) |
            df_filtrado["ano"].str.contains(termo, na=False)
        ]
        if df_filtrado.empty:
            break

    # Se achou, retorna
    if not df_filtrado.empty:
        return {"carros": adicionar_imagem(df_filtrado), "total": len(df_filtrado)}

    # Se não achou → fuzzy match (marca, modelo ou ano)
    valores_validos = pd.concat([df["marca"], df["modelo"], df["ano"]]).unique()
    sugestao, score, _ = process.extractOne(termos[0], valores_validos, scorer=fuzz.WRatio)

    if score >= 70:
        df_sugerido = df[
            df["marca"].str.contains(sugestao, na=False) |
            df["modelo"].str.contains(sugestao, na=False) |
            df["ano"].str.contains(sugestao, na=False)
        ]
        return {
            "mensagem": f"Nenhum carro encontrado com '{busca}', exibindo resultados semelhantes a '{sugestao}'",
            "carros": adicionar_imagem(df_sugerido),
            "total": len(df_sugerido)
        }

    # Se nem fuzzy achou
    return {"mensagem": f"Nenhum carro encontrado com '{busca}'", "carros": [], "total": 0}

@app.post("/favoritar/{usuario_id}")
def favoritar_veiculo(usuario_id: int, codigo: str = Body(..., embed=True), db: Session = Depends(get_db)):
    """
    Favorita um veículo baseado no código existente na planilha.
    O front envia: { "codigo": "COD12345" }
    """

    # Caminho da planilha
    ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    caminho = os.path.join(ROOT_DIR, "data", "dados convertidos.xlsx")

    if not os.path.exists(caminho):
        raise HTTPException(status_code=404, detail="Arquivo da planilha não encontrado")

    # Lê a planilha
    df = pd.read_excel(caminho)



    # Normaliza colunas: remove espaços, acentos, coloca lower
    df.columns = [
        c.strip().lower()
        .replace(" ", "_")
        .replace("-", "_")
        .replace("(", "")
        .replace(")", "")
        .replace("ç", "c")
    for c in df.columns
    ]

    # Normaliza coluna de código
    if "codigo" not in df.columns:
        raise HTTPException(status_code=500, detail="Coluna 'codigo' ausente na planilha")
    df["codigo"] = df["codigo"].astype(str).str.strip()
    codigo = str(codigo).strip()

    # Busca o carro pelo código
    carro = df[df["codigo"] == codigo.upper()].to_dict(orient="records")
    if not carro:
        raise HTTPException(status_code=404, detail=f"Nenhum carro encontrado com código {codigo}")
    carro = carro[0]

    print("Colunas normalizadas:", df.columns.tolist())
    print("Chaves do carro encontrado:", carro.keys())

    # --- Cria ou busca combustível corretamente ---
    combustivel_tipo = carro.get("combustível", "N/A").strip().upper()  # Ex: "F", "G"
    combustivel = db.query(Combustivel).filter(Combustivel.tipo == combustivel_tipo).first()
    if not combustivel:
        combustivel = Combustivel(tipo=combustivel_tipo)
        db.add(combustivel)
        db.commit()
        db.refresh(combustivel)

    # --- Converte ar_condicionado para boolean ---
    ar_condicionado = carro.get("ar_condicionado", "N")
    if isinstance(ar_condicionado, str):
        ar_condicionado = ar_condicionado.strip().lower() in ["sim", "s", "true", "1"]
    else:
        ar_condicionado = bool(ar_condicionado)

    # --- Converte direcao_assistida para Enum válido ---
    direcao_assistida = carro.get("direcao_assistida", "M")
    if direcao_assistida not in ["H", "E", "H-E", "M"]:
        direcao_assistida = "M"

    # --- Cria ou busca veículo ---
    veiculo = db.query(Veiculo).filter_by(codigo=carro["codigo"]).first()
    if not veiculo:
        veiculo = Veiculo(
            codigo=carro["codigo"],
            ano=int(carro.get("ano", 0)),
            categoria=carro.get("categoria"),
            marca=carro.get("marca"),
            modelo=carro.get("modelo"),
            versao=carro.get("versao"),
            motor=carro.get("motor"),
            transmissao=carro.get("transmissao"),
            ar_condicionado=ar_condicionado,
            direcao_assistida=direcao_assistida
        )
        db.add(veiculo)
        db.commit()
        db.refresh(veiculo)

    # --- Cria emissões ---
    emissao = Emissao(
        veiculo_id=veiculo.veiculo_id,
        combustivel_id=combustivel.combustivel_id,
        nmhc=float(carro.get("emissão_de_nmhc_g/km") or 0),
        co=float(carro.get("emissão_de_co_g/km") or 0),
        nox=float(carro.get("emissão_de_nox_g/km") or 0),
        co2=float(
            carro.get("emissão_de_co2_gás_efeito_estufa_a_produzido_pela_combustão_do_etanol_g/km")
            or carro.get("emissão_de_co2_gás_efeito_estufa_a_produzido_pela_combustão_da_gasolina_ou_diesel__g/km")
            or 0
        )
    )
    db.add(emissao)

    # --- Cria consumo ---
    consumo = Consumo(
        veiculo_id=veiculo.veiculo_id,
        combustivel_id=combustivel.combustivel_id,
        rendimento_cidade=float(
            carro.get("rendimento_da_gasolina_ou_diesel_na_cidade_km/l")
            or carro.get("rendimento_do_etanol_na_cidade_km/l")
            or 0
        ),
        rendimento_estrada=float(
            carro.get("rendimento_da_gasolina_ou_diesel_estrada_km/l")
            or carro.get("rendimento_do_etanol_na_estrada_km/l")
            or 0
        ),
        consumo_energetico=float(carro.get("consumo_energético_mj/km") or 0)
    )
    db.add(consumo)
    db.commit()

    # --- ADICIONA OU REMOVE FAVORITO ---
    favorito_existente = db.query(Favorito).filter_by(usuario_id=usuario_id, veiculo_id=veiculo.veiculo_id).first()
    if favorito_existente:
        db.delete(favorito_existente)
        msg = "Veículo removido dos favoritos."
    else:
        novo_fav = Favorito(usuario_id=usuario_id, veiculo_id=veiculo.veiculo_id)
        db.add(novo_fav)
        msg = "Veículo adicionado aos favoritos."

    db.commit()

    return {"mensagem": msg}

@app.get("/veiculos_favoritos/{usuario_id}")
def get_veiculos_favoritos(usuario_id: int, db: Session = Depends(get_db)):
    # Busca todos os veículos favoritos do usuário com JOINs automáticos
    favoritos = (
        db.query(models.Favorito)
        .options(
            joinedload(models.Favorito.veiculo)
            .joinedload(models.Veiculo.emissoes)
            .joinedload(models.Emissao.combustivel),
            joinedload(models.Favorito.veiculo)
            .joinedload(models.Veiculo.consumos)
            .joinedload(models.Consumo.combustivel),
        )
        .filter(models.Favorito.usuario_id == usuario_id)
        .all()
    )

    if not favoritos:
        raise HTTPException(status_code=404, detail="Nenhum veículo favorito encontrado.")

    resultado = []

    for fav in favoritos:
        veiculo = fav.veiculo
        if not veiculo:
            continue

        # Pega o primeiro combustível encontrado (caso haja mais de um)
        emissao = veiculo.emissoes[0] if veiculo.emissoes else None
        consumo = veiculo.consumos[0] if veiculo.consumos else None

        resultado.append({
            "veiculo_id": veiculo.veiculo_id,
            "ano": veiculo.ano,
            "categoria": veiculo.categoria,
            "marca": veiculo.marca,
            "modelo": veiculo.modelo,
            "versao": veiculo.versao,
            "motor": veiculo.motor,
            "transmissao": veiculo.transmissao,
            "ar_condicionado": veiculo.ar_condicionado,
            "direcao_assistida": veiculo.direcao_assistida,
            "combustivel": (
                emissao.combustivel.tipo
                if emissao and emissao.combustivel
                else consumo.combustivel.tipo
                if consumo and consumo.combustivel
                else None
            ),

            # Dados de emissão (se houver)
            "emissao_nmhc": float(emissao.nmhc) if emissao and emissao.nmhc else None,
            "emissao_co": float(emissao.co) if emissao and emissao.co else None,
            "emissao_nox": float(emissao.nox) if emissao and emissao.nox else None,
            "emissao_co2": float(emissao.co2) if emissao and emissao.co2 else None,

            # Dados de consumo (se houver)
            "rendimento_cidade": float(consumo.rendimento_cidade) if consumo and consumo.rendimento_cidade else None,
            "rendimento_estrada": float(consumo.rendimento_estrada) if consumo and consumo.rendimento_estrada else None,
            "consumo_energetico": float(consumo.consumo_energetico) if consumo and consumo.consumo_energetico else None,
        })

    return resultado