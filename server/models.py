from sqlalchemy import Column, String, Boolean, Numeric, TIMESTAMP, text
from sqlalchemy.orm import relationship
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
