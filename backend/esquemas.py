from pydantic import BaseModel, EmailStr
from typing import Optional

from pydantic import BaseModel

class VeiculoFavorito(BaseModel):
    marca: str
    modelo: str
    ano: int
    categoria: str | None = None
    versao: str | None = None
    motor: str | None = None
    transmissao: str | None = None
    ar_condicionado: bool | None = None
    direcao_assistida: str | None = None
    combustivel: str | None = None
    nmhc: float | None = None
    co: float | None = None
    nox: float | None = None
    co2_etanol: float | None = None
    co2_gasolina: float | None = None
    rendimento_etanol_cidade: float | None = None
    rendimento_etanol_estrada: float | None = None
    rendimento_gasolina_cidade: float | None = None
    rendimento_gasolina_estrada: float | None = None
    consumo_energetico: float | None = None

class UsuarioCreate(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    
class UsuarioUpdate(BaseModel):
    nome: str | None = None
    senha: str | None = None

class UsuarioLogin(BaseModel):
    email: EmailStr
    senha: str

class UsuarioResponse(BaseModel):
    usuario_id: int
    nome: str
    email: EmailStr

    class Config:
        from_attributes = True

class FavoritoCreate(BaseModel):
    usuario_id: int
    veiculo_id: int
    
class EmailRequest(BaseModel):
    email: str
    
