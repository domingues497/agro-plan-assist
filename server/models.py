from sqlalchemy import Column, String, Boolean, Numeric, TIMESTAMP, Integer, text
from sqlalchemy.orm import relationship
try:
    from sa import Base
except ImportError:
    from server.sa import Base


class Consultor(Base):
    __tablename__ = "consultores"
    id = Column(String, primary_key=True)
    numerocm_consultor = Column(String, nullable=False)
    consultor = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True)
    role = Column(String, nullable=False, server_default=text("'consultor'"))
    ativo = Column(Boolean, nullable=False, server_default=text("true"))
    pode_editar_programacao = Column(Boolean, nullable=False, server_default=text("false"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class Produtor(Base):
    __tablename__ = "produtores"
    id = Column(String, primary_key=True)
    numerocm = Column(String, nullable=False, unique=True)
    nome = Column(String, nullable=False)
    numerocm_consultor = Column(String, nullable=False)
    consultor = Column(String)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class Fazenda(Base):
    __tablename__ = "fazendas"
    id = Column(String, primary_key=True)
    numerocm = Column(String, nullable=False)
    idfazenda = Column(String, nullable=False)
    nomefazenda = Column(String, nullable=False)
    numerocm_consultor = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class Talhao(Base):
    __tablename__ = "talhoes"
    id = Column(String, primary_key=True)
    fazenda_id = Column(String, nullable=False)
    nome = Column(String, nullable=False)
    area = Column(Numeric, nullable=False)
    arrendado = Column(Boolean, nullable=False, server_default=text("false"))
    safras_todas = Column(Boolean, nullable=False, server_default=text("true"))
    kml_name = Column(String)
    kml_uploaded_at = Column(TIMESTAMP(timezone=True))
    kml_text = Column(String)
    geojson = Column(String)
    centroid_lat = Column(Numeric)
    centroid_lng = Column(Numeric)
    bbox_min_lat = Column(Numeric)
    bbox_min_lng = Column(Numeric)
    bbox_max_lat = Column(Numeric)
    bbox_max_lng = Column(Numeric)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class AppVersion(Base):
    __tablename__ = "app_versions"
    id = Column(String, primary_key=True)
    version = Column(String, nullable=False)
    build = Column(String)
    environment = Column(String)
    notes = Column(String)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class SystemConfig(Base):
    __tablename__ = "system_config"
    config_key = Column(String, primary_key=True)
    config_value = Column(String)
    description = Column(String)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class ImportHistory(Base):
    __tablename__ = "import_history"
    id = Column(String, primary_key=True)
    user_id = Column(String)
    tabela_nome = Column(String, nullable=False)
    registros_importados = Column(Integer, nullable=False)
    registros_deletados = Column(Integer, nullable=False)
    arquivo_nome = Column(String)
    limpar_antes = Column(Boolean, server_default=text("false"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class CalendarioAplicacao(Base):
    __tablename__ = "calendario_aplicacoes"
    id = Column(String, primary_key=True)
    cod_aplic = Column(String, nullable=False)
    descr_aplicacao = Column(String, nullable=False)
    cod_aplic_ger = Column(String)
    cod_classe = Column(String, nullable=False)
    descricao_classe = Column(String, nullable=False)
    trat_sementes = Column(String)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class DefensivoCatalog(Base):
    __tablename__ = "defensivos_catalog"
    cod_item = Column(String, primary_key=True)
    item = Column(String)
    grupo = Column(String)
    marca = Column(String)
    principio_ativo = Column(String)
    saldo = Column(Numeric)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class FertilizanteCatalog(Base):
    __tablename__ = "fertilizantes_catalog"
    cod_item = Column(String, primary_key=True)
    item = Column(String)
    marca = Column(String)
    principio_ativo = Column(String)
    saldo = Column(Numeric)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class CultivarCatalog(Base):
    __tablename__ = "cultivares_catalog"
    cultivar = Column(String, primary_key=True)
    cultura = Column(String)
    nome_cientifico = Column(String)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class TratamentoSemente(Base):
    __tablename__ = "tratamentos_sementes"
    id = Column(String, primary_key=True)
    nome = Column(String)
    cultura = Column(String)
    ativo = Column(Boolean, nullable=False, server_default=text("true"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class CultivarTratamento(Base):
    __tablename__ = "cultivares_tratamentos"
    cultivar = Column(String, primary_key=True)
    tratamento_id = Column(String, primary_key=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class Epoca(Base):
    __tablename__ = "epocas"
    id = Column(String, primary_key=True)
    nome = Column(String)
    descricao = Column(String)
    ativa = Column(Boolean, nullable=False, server_default=text("true"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class JustificativaAdubacao(Base):
    __tablename__ = "justificativas_adubacao"
    id = Column(String, primary_key=True)
    descricao = Column(String)
    ativo = Column(Boolean, nullable=False, server_default=text("true"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class Embalagem(Base):
    __tablename__ = "embalagens"
    id = Column(String, primary_key=True)
    nome = Column(String, nullable=False)
    ativo = Column(Boolean, nullable=False, server_default=text("true"))
    scope_cultivar = Column(Boolean, nullable=False, server_default=text("false"))
    scope_fertilizante = Column(Boolean, nullable=False, server_default=text("false"))
    scope_defensivo = Column(Boolean, nullable=False, server_default=text("false"))
    cultura = Column(String)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class UserProdutor(Base):
    __tablename__ = "user_produtores"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    produtor_numerocm = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class UserFazenda(Base):
    __tablename__ = "user_fazendas"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    fazenda_id = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class GestorConsultor(Base):
    __tablename__ = "gestor_consultores"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    numerocm_consultor = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
