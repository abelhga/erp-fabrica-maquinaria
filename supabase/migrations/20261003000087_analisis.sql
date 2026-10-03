-- =============================================================================
-- BI de dirección: dónde se vende, qué se vende, a quién y contra qué meta.
--
-- El tablero de inicio dice cómo va el año; no dice dónde crecer. Para eso hacían
-- falta tres cosas que la hoja nunca tuvo:
--   1. Ubicar a cada cliente en un estado y un municipio del INEGI. La hoja trae
--      "Queretaro", "Tepatitlan", "CD. Obregon", "Estado de México" en texto libre;
--      sin una clave no hay mapa. Lo que no se reconoce va a una cola que dirección
--      corrige una vez (alias) y se aplica a todos los clientes que coinciden.
--   2. Saber qué se vendió. El libro de ventas solo trae "zeus 30 fija" o "20 mts
--      g.t. 18"": una tabla de reglas (patrón → familia) que dirección puede editar
--      lo clasifica, y lo que no cae en ninguna regla se ve y se cuenta.
--   3. Una meta anual repartida con la estacionalidad real, para saber a qué ritmo
--      hay que vender lo que falta.
--
-- Las ventas salen de la MISMA regla que el tablero (ventas_entre): el libro de la
-- hoja hasta el arranque y los pedidos del ERP después. Si el mapa y el tablero no
-- cuadran, nadie le cree a ninguno; la prueba 88 lo revisa al centavo.
--
-- Permisos: módulo "analisis" (dirección 3, gerencia de ventas 1). Todo es
-- security invoker (la RLS de ventas filtra) y además revisa puede('analisis') al
-- entrar. Aquí no hay costos ni márgenes: ventas nunca debe ver uno.
-- =============================================================================

insert into public.permisos_rol (rol, modulo, nivel) values
  ('direccion', 'analisis', 3), ('gerente_ventas', 'analisis', 1)
on conflict (rol, modulo) do nothing;

create or replace function public.exigir_analisis(p_nivel int default 1) returns void
language plpgsql stable security invoker set search_path = public as $$
begin
  if not puede('analisis', p_nivel) then
    raise exception '%', case when p_nivel >= 3 then 'Solo dirección puede cambiar esto.'
                              else 'El análisis de dirección no está en tu rol.' end
      using errcode = '42501';
  end if;
end $$;

-- =============================================================================
-- 1. Geografía: catálogo INEGI, alias y la función que ubica
-- =============================================================================

-- levenshtein() para los errores de dedo: "Guadajara" está a dos letras de Guadalajara.
create extension if not exists fuzzystrmatch with schema extensions;

-- "Tepatitlán de Morelos", "TEPATITLAN DE MORELOS." y "tepatitlan  de morelos" son lo mismo.
create or replace function public.geo_normalizar(t text) returns text
language sql immutable parallel safe as $$
  select nullif(btrim(regexp_replace(public.sin_acentos(t), '[^a-z0-9]+', ' ', 'g')), '')
$$;

create table if not exists public.geo_estados (
  cve_ent text primary key check (cve_ent ~ '^[0-9]{2}$'),
  nombre text not null,                 -- oficial: "Michoacán de Ocampo", "México"
  nombre_corto text not null,           -- como se dice: "Michoacán", "Estado de México"
  abreviatura text not null,
  nombre_norm text generated always as (public.geo_normalizar(nombre)) stored,
  corto_norm text generated always as (public.geo_normalizar(nombre_corto)) stored
);

create table if not exists public.geo_municipios (
  cvegeo text primary key check (cvegeo ~ '^[0-9]{5}$'),
  cve_ent text not null references public.geo_estados(cve_ent),
  nombre text not null,
  nombre_norm text generated always as (public.geo_normalizar(nombre)) stored
);
create index if not exists geo_municipios_nombre_trgm on public.geo_municipios using gin (nombre_norm extensions.gin_trgm_ops);
create index if not exists geo_municipios_estado on public.geo_municipios (cve_ent, nombre_norm);
create index if not exists geo_municipios_norm on public.geo_municipios (nombre_norm);

-- >>> catálogo INEGI (generado desde supabase/datos/municipios.json; no editar a mano)
insert into public.geo_estados (cve_ent, nombre, nombre_corto, abreviatura) values
  ('01', 'Aguascalientes', 'Aguascalientes', 'Ags.'),
  ('02', 'Baja California', 'Baja California', 'BC'),
  ('03', 'Baja California Sur', 'Baja California Sur', 'BCS'),
  ('04', 'Campeche', 'Campeche', 'Camp.'),
  ('05', 'Coahuila de Zaragoza', 'Coahuila', 'Coah.'),
  ('06', 'Colima', 'Colima', 'Col.'),
  ('07', 'Chiapas', 'Chiapas', 'Chis.'),
  ('08', 'Chihuahua', 'Chihuahua', 'Chih.'),
  ('09', 'Ciudad de México', 'Ciudad de México', 'CDMX'),
  ('10', 'Durango', 'Durango', 'Dgo.'),
  ('11', 'Guanajuato', 'Guanajuato', 'Gto.'),
  ('12', 'Guerrero', 'Guerrero', 'Gro.'),
  ('13', 'Hidalgo', 'Hidalgo', 'Hgo.'),
  ('14', 'Jalisco', 'Jalisco', 'Jal.'),
  ('15', 'México', 'Estado de México', 'Méx.'),
  ('16', 'Michoacán de Ocampo', 'Michoacán', 'Mich.'),
  ('17', 'Morelos', 'Morelos', 'Mor.'),
  ('18', 'Nayarit', 'Nayarit', 'Nay.'),
  ('19', 'Nuevo León', 'Nuevo León', 'NL'),
  ('20', 'Oaxaca', 'Oaxaca', 'Oax.'),
  ('21', 'Puebla', 'Puebla', 'Pue.'),
  ('22', 'Querétaro', 'Querétaro', 'Qro.'),
  ('23', 'Quintana Roo', 'Quintana Roo', 'Q. Roo'),
  ('24', 'San Luis Potosí', 'San Luis Potosí', 'SLP'),
  ('25', 'Sinaloa', 'Sinaloa', 'Sin.'),
  ('26', 'Sonora', 'Sonora', 'Son.'),
  ('27', 'Tabasco', 'Tabasco', 'Tab.'),
  ('28', 'Tamaulipas', 'Tamaulipas', 'Tamps.'),
  ('29', 'Tlaxcala', 'Tlaxcala', 'Tlax.'),
  ('30', 'Veracruz de Ignacio de la Llave', 'Veracruz', 'Ver.'),
  ('31', 'Yucatán', 'Yucatán', 'Yuc.'),
  ('32', 'Zacatecas', 'Zacatecas', 'Zac.')
on conflict (cve_ent) do update set nombre = excluded.nombre, nombre_corto = excluded.nombre_corto, abreviatura = excluded.abreviatura;

insert into public.geo_municipios (cvegeo, cve_ent, nombre) values
  ('01001','01','Aguascalientes'),('01002','01','Asientos'),('01003','01','Calvillo'),('01004','01','Cosío'),('01005','01','Jesús María'),('01006','01','Pabellón de Arteaga'),
  ('01007','01','Rincón de Romos'),('01008','01','San José de Gracia'),('01009','01','Tepezalá'),('01010','01','El Llano'),('01011','01','San Francisco de los Romo'),('02001','02','Ensenada'),
  ('02002','02','Mexicali'),('02003','02','Tecate'),('02004','02','Tijuana'),('02005','02','Playas de Rosarito'),('02006','02','San Quintín'),('02007','02','San Felipe'),
  ('03001','03','Comondú'),('03002','03','Mulegé'),('03003','03','La Paz'),('03008','03','Los Cabos'),('03009','03','Loreto'),('04001','04','Calkiní'),
  ('04002','04','Campeche'),('04003','04','Carmen'),('04004','04','Champotón'),('04005','04','Hecelchakán'),('04006','04','Hopelchén'),('04007','04','Palizada'),
  ('04008','04','Tenabo'),('04009','04','Escárcega'),('04010','04','Calakmul'),('04011','04','Candelaria'),('04012','04','Seybaplaya'),('04013','04','Dzitbalché'),
  ('05001','05','Abasolo'),('05002','05','Acuña'),('05003','05','Allende'),('05004','05','Arteaga'),('05005','05','Candela'),('05006','05','Castaños'),
  ('05007','05','Cuatro Ciénegas'),('05008','05','Escobedo'),('05009','05','Francisco I. Madero'),('05010','05','Frontera'),('05011','05','General Cepeda'),('05012','05','Guerrero'),
  ('05013','05','Hidalgo'),('05014','05','Jiménez'),('05015','05','Juárez'),('05016','05','Lamadrid'),('05017','05','Matamoros'),('05018','05','Monclova'),
  ('05019','05','Morelos'),('05020','05','Múzquiz'),('05021','05','Nadadores'),('05022','05','Nava'),('05023','05','Ocampo'),('05024','05','Parras'),
  ('05025','05','Piedras Negras'),('05026','05','Progreso'),('05027','05','Ramos Arizpe'),('05028','05','Sabinas'),('05029','05','Sacramento'),('05030','05','Saltillo'),
  ('05031','05','San Buenaventura'),('05032','05','San Juan de Sabinas'),('05033','05','San Pedro'),('05034','05','Sierra Mojada'),('05035','05','Torreón'),('05036','05','Viesca'),
  ('05037','05','Villa Unión'),('05038','05','Zaragoza'),('06001','06','Armería'),('06002','06','Colima'),('06003','06','Comala'),('06004','06','Coquimatlán'),
  ('06005','06','Cuauhtémoc'),('06006','06','Ixtlahuacán'),('06007','06','Manzanillo'),('06008','06','Minatitlán'),('06009','06','Tecomán'),('06010','06','Villa de Álvarez'),
  ('07001','07','Acacoyagua'),('07002','07','Acala'),('07003','07','Acapetahua'),('07004','07','Altamirano'),('07005','07','Amatán'),('07006','07','Amatenango de la Frontera'),
  ('07007','07','Amatenango del Valle'),('07008','07','Ángel Albino Corzo'),('07009','07','Arriaga'),('07010','07','Bejucal de Ocampo'),('07011','07','Bella Vista'),('07012','07','Berriozábal'),
  ('07013','07','Bochil'),('07014','07','El Bosque'),('07015','07','Cacahoatán'),('07016','07','Catazajá'),('07017','07','Cintalapa de Figueroa'),('07018','07','Coapilla'),
  ('07019','07','Comitán de Domínguez'),('07020','07','La Concordia'),('07021','07','Copainalá'),('07022','07','Chalchihuitán'),('07023','07','Chamula'),('07024','07','Chanal'),
  ('07025','07','Chapultenango'),('07026','07','Chenalhó'),('07027','07','Chiapa de Corzo'),('07028','07','Chiapilla'),('07029','07','Chicoasén'),('07030','07','Chicomuselo'),
  ('07031','07','Chilón'),('07032','07','Escuintla'),('07033','07','Francisco León'),('07034','07','Frontera Comalapa'),('07035','07','Frontera Hidalgo'),('07036','07','La Grandeza'),
  ('07037','07','Huehuetán'),('07038','07','Huixtán'),('07039','07','Huitiupán'),('07040','07','Huixtla'),('07041','07','La Independencia'),('07042','07','Ixhuatán'),
  ('07043','07','Ixtacomitán'),('07044','07','Ixtapa'),('07045','07','Ixtapangajoya'),('07046','07','Jiquipilas'),('07047','07','Jitotol'),('07048','07','Juárez'),
  ('07049','07','Larráinzar'),('07050','07','La Libertad'),('07051','07','Mapastepec'),('07052','07','Las Margaritas'),('07053','07','Mazapa de Madero'),('07054','07','Mazatán'),
  ('07055','07','Metapa'),('07056','07','Mitontic'),('07057','07','Motozintla'),('07058','07','Nicolás Ruíz'),('07059','07','Ocosingo'),('07060','07','Ocotepec'),
  ('07061','07','Ocozocoautla de Espinosa'),('07062','07','Ostuacán'),('07063','07','Osumacinta'),('07064','07','Oxchuc'),('07065','07','Palenque'),('07066','07','Pantelhó'),
  ('07067','07','Pantepec'),('07068','07','Pichucalco'),('07069','07','Pijijiapan'),('07070','07','El Porvenir'),('07071','07','Villa Comaltitlán'),('07072','07','Pueblo Nuevo Solistahuacán'),
  ('07073','07','Rayón'),('07074','07','Reforma'),('07075','07','Las Rosas'),('07076','07','Sabanilla'),('07077','07','Salto de Agua'),('07078','07','San Cristóbal de las Casas'),
  ('07079','07','San Fernando'),('07080','07','Siltepec'),('07081','07','Simojovel'),('07082','07','Sitalá'),('07083','07','Socoltenango'),('07084','07','Solosuchiapa'),
  ('07085','07','Soyaló'),('07086','07','Suchiapa'),('07087','07','Suchiate'),('07088','07','Sunuapa'),('07089','07','Tapachula'),('07090','07','Tapalapa'),
  ('07091','07','Tapilula'),('07092','07','Tecpatán'),('07093','07','Tenejapa'),('07094','07','Teopisca'),('07096','07','Tila'),('07097','07','Tonalá'),
  ('07098','07','Totolapa'),('07099','07','La Trinitaria'),('07100','07','Tumbalá'),('07101','07','Tuxtla Gutiérrez'),('07102','07','Tuxtla Chico'),('07103','07','Tuzantán'),
  ('07104','07','Tzimol'),('07105','07','Unión Juárez'),('07106','07','Venustiano Carranza'),('07107','07','Villa Corzo'),('07108','07','Villaflores'),('07109','07','Yajalón'),
  ('07110','07','San Lucas'),('07111','07','Zinacantán'),('07112','07','San Juan Cancuc'),('07113','07','Aldama'),('07114','07','Benemérito de las Américas'),('07115','07','Maravilla Tenejapa'),
  ('07116','07','Marqués de Comillas'),('07117','07','Montecristo de Guerrero'),('07118','07','San Andrés Duraznal'),('07119','07','Santiago el Pinar'),('07120','07','Capitán Luis Ángel Vidal'),('07121','07','Rincón Chamula San Pedro'),
  ('07122','07','El Parral'),('07123','07','Emiliano Zapata'),('07124','07','Mezcalapa'),('07125','07','Honduras de la Sierra'),('08001','08','Ahumada'),('08002','08','Aldama'),
  ('08003','08','Allende'),('08004','08','Aquiles Serdán'),('08005','08','Ascensión'),('08006','08','Bachíniva'),('08007','08','Balleza'),('08008','08','Batopilas de Manuel Gómez Morín'),
  ('08009','08','Bocoyna'),('08010','08','Buenaventura'),('08011','08','Camargo'),('08012','08','Carichí'),('08013','08','Casas Grandes'),('08014','08','Coronado'),
  ('08015','08','Coyame del Sotol'),('08016','08','La Cruz'),('08017','08','Cuauhtémoc'),('08018','08','Cusihuiriachi'),('08019','08','Chihuahua'),('08020','08','Chínipas'),
  ('08021','08','Delicias'),('08022','08','Dr. Belisario Domínguez'),('08023','08','Galeana'),('08024','08','Santa Isabel'),('08025','08','Gómez Farías'),('08026','08','Gran Morelos'),
  ('08027','08','Guachochi'),('08028','08','Guadalupe'),('08029','08','Guadalupe y Calvo'),('08030','08','Guazapares'),('08031','08','Guerrero'),('08032','08','Hidalgo del Parral'),
  ('08033','08','Huejotitán'),('08034','08','Ignacio Zaragoza'),('08035','08','Janos'),('08036','08','Jiménez'),('08037','08','Juárez'),('08038','08','Julimes'),
  ('08039','08','López'),('08040','08','Madera'),('08041','08','Maguarichi'),('08042','08','Manuel Benavides'),('08043','08','Matachí'),('08044','08','Matamoros'),
  ('08045','08','Meoqui'),('08046','08','Morelos'),('08047','08','Moris'),('08048','08','Namiquipa'),('08049','08','Nonoava'),('08050','08','Nuevo Casas Grandes'),
  ('08051','08','Ocampo'),('08052','08','Ojinaga'),('08053','08','Praxedis G. Guerrero'),('08054','08','Riva Palacio'),('08055','08','Rosales'),('08056','08','Rosario'),
  ('08057','08','San Francisco de Borja'),('08058','08','San Francisco de Conchos'),('08059','08','San Francisco del Oro'),('08060','08','Santa Bárbara'),('08061','08','Satevó'),('08062','08','Saucillo'),
  ('08063','08','Temósachic'),('08064','08','El Tule'),('08065','08','Urique'),('08066','08','Uruachi'),('08067','08','Valle de Zaragoza'),('09002','09','Azcapotzalco'),
  ('09003','09','Coyoacán'),('09004','09','Cuajimalpa de Morelos'),('09005','09','Gustavo A. Madero'),('09006','09','Iztacalco'),('09007','09','Iztapalapa'),('09008','09','La Magdalena Contreras'),
  ('09009','09','Milpa Alta'),('09010','09','Álvaro Obregón'),('09011','09','Tláhuac'),('09012','09','Tlalpan'),('09013','09','Xochimilco'),('09014','09','Benito Juárez'),
  ('09015','09','Cuauhtémoc'),('09016','09','Miguel Hidalgo'),('09017','09','Venustiano Carranza'),('10001','10','Canatlán'),('10002','10','Canelas'),('10003','10','Coneto de Comonfort'),
  ('10004','10','Cuencamé'),('10005','10','Durango'),('10006','10','General Simón Bolívar'),('10007','10','Gómez Palacio'),('10008','10','Guadalupe Victoria'),('10009','10','Guanaceví'),
  ('10010','10','Hidalgo'),('10011','10','Indé'),('10012','10','Lerdo'),('10013','10','Mapimí'),('10014','10','Mezquital'),('10015','10','Nazas'),
  ('10016','10','Nombre de Dios'),('10017','10','Ocampo'),('10018','10','El Oro'),('10019','10','Otáez'),('10020','10','Pánuco de Coronado'),('10021','10','Peñón Blanco'),
  ('10022','10','Poanas'),('10023','10','Pueblo Nuevo'),('10024','10','Rodeo'),('10025','10','San Bernardo'),('10026','10','San Dimas'),('10027','10','San Juan de Guadalupe'),
  ('10028','10','San Juan del Río'),('10029','10','San Luis del Cordero'),('10030','10','San Pedro del Gallo'),('10031','10','Santa Clara'),('10032','10','Santiago Papasquiaro'),('10033','10','Súchil'),
  ('10034','10','Tamazula'),('10035','10','Tepehuanes'),('10036','10','Tlahualilo'),('10037','10','Topia'),('10038','10','Vicente Guerrero'),('10039','10','Nuevo Ideal'),
  ('11001','11','Abasolo'),('11002','11','Acámbaro'),('11003','11','San Miguel de Allende'),('11004','11','Apaseo el Alto'),('11005','11','Apaseo el Grande'),('11006','11','Atarjea'),
  ('11007','11','Celaya'),('11008','11','Manuel Doblado'),('11009','11','Comonfort'),('11010','11','Coroneo'),('11011','11','Cortazar'),('11012','11','Cuerámaro'),
  ('11013','11','Doctor Mora'),('11014','11','Dolores Hidalgo Cuna de la Independencia Nacional'),('11015','11','Guanajuato'),('11016','11','Huanímaro'),('11017','11','Irapuato'),('11018','11','Jaral del Progreso'),
  ('11019','11','Jerécuaro'),('11020','11','León'),('11021','11','Moroleón'),('11022','11','Ocampo'),('11023','11','Pénjamo'),('11024','11','Pueblo Nuevo'),
  ('11025','11','Purísima del Rincón'),('11026','11','Romita'),('11027','11','Salamanca'),('11028','11','Salvatierra'),('11029','11','San Diego de la Unión'),('11030','11','San Felipe'),
  ('11031','11','San Francisco del Rincón'),('11032','11','San José Iturbide'),('11033','11','San Luis de la Paz'),('11034','11','Santa Catarina'),('11035','11','Santa Cruz de Juventino Rosas'),('11036','11','Santiago Maravatío'),
  ('11037','11','Silao de la Victoria'),('11038','11','Tarandacuao'),('11039','11','Tarimoro'),('11040','11','Tierra Blanca'),('11041','11','Uriangato'),('11042','11','Valle de Santiago'),
  ('11043','11','Victoria'),('11044','11','Villagrán'),('11045','11','Xichú'),('11046','11','Yuriria'),('12001','12','Acapulco de Juárez'),('12002','12','Ahuacuotzingo'),
  ('12003','12','Ajuchitlán del Progreso'),('12004','12','Alcozauca de Guerrero'),('12005','12','Alpoyeca'),('12006','12','Apaxtla'),('12007','12','Arcelia'),('12008','12','Atenango del Río'),
  ('12009','12','Atlamajalcingo del Monte'),('12010','12','Atlixtac'),('12011','12','Atoyac de Álvarez'),('12012','12','Ayutla de los Libres'),('12013','12','Azoyú'),('12014','12','Benito Juárez'),
  ('12015','12','Buenavista de Cuéllar'),('12016','12','Coahuayutla de José María Izazaga'),('12017','12','Cocula'),('12018','12','Copala'),('12019','12','Copalillo'),('12020','12','Copanatoyac'),
  ('12021','12','Coyuca de Benítez'),('12022','12','Coyuca de Catalán'),('12023','12','Cuajinicuilapa'),('12024','12','Cualác'),('12025','12','Cuautepec'),('12026','12','Cuetzala del Progreso'),
  ('12027','12','Cutzamala de Pinzón'),('12028','12','Chilapa de Álvarez'),('12029','12','Chilpancingo de los Bravo'),('12030','12','Florencio Villarreal'),('12031','12','General Canuto A. Neri'),('12032','12','General Heliodoro Castillo'),
  ('12033','12','Huamuxtitlán'),('12034','12','Huitzuco de los Figueroa'),('12035','12','Iguala de la Independencia'),('12036','12','Igualapa'),('12037','12','Ixcateopan de Cuauhtémoc'),('12038','12','Zihuatanejo de Azueta'),
  ('12039','12','Juan R. Escudero'),('12040','12','Leonardo Bravo'),('12041','12','Malinaltepec'),('12042','12','Mártir de Cuilapan'),('12043','12','Metlatónoc'),('12044','12','Mochitlán'),
  ('12045','12','Olinalá'),('12046','12','Ometepec'),('12047','12','Pedro Ascencio Alquisiras'),('12048','12','Petatlán'),('12049','12','Pilcaya'),('12050','12','Pungarabato'),
  ('12051','12','Quechultenango'),('12052','12','San Luis Acatlán'),('12053','12','San Marcos'),('12054','12','San Miguel Totolapan'),('12055','12','Taxco de Alarcón'),('12056','12','Tecoanapa'),
  ('12057','12','Técpan de Galeana'),('12058','12','Teloloapan'),('12059','12','Tepecoacuilco de Trujano'),('12060','12','Tetipac'),('12061','12','Tixtla de Guerrero'),('12062','12','Tlacoachistlahuaca'),
  ('12063','12','Tlacoapa'),('12064','12','Tlalchapa'),('12065','12','Tlalixtaquilla de Maldonado'),('12066','12','Tlapa de Comonfort'),('12067','12','Tlapehuala'),('12068','12','La Unión de Isidoro Montes de Oca'),
  ('12069','12','Xalpatláhuac'),('12070','12','Xochihuehuetlán'),('12071','12','Xochistlahuaca'),('12072','12','Zapotitlán Tablas'),('12073','12','Zirándaro'),('12074','12','Zitlala'),
  ('12075','12','Eduardo Neri'),('12076','12','Acatepec'),('12077','12','Marquelia'),('12078','12','Cochoapa el Grande'),('12079','12','José Joaquín de Herrera'),('12080','12','Juchitán'),
  ('12081','12','Iliatenco'),('12082','12','Las Vigas'),('12083','12','Ñuu Savi'),('12084','12','Santa Cruz del Rincón'),('12085','12','San Nicolás'),('13001','13','Acatlán'),
  ('13002','13','Acaxochitlán'),('13003','13','Actopan'),('13004','13','Agua Blanca de Iturbide'),('13005','13','Ajacuba'),('13006','13','Alfajayucan'),('13007','13','Almoloya'),
  ('13008','13','Apan'),('13009','13','El Arenal'),('13010','13','Atitalaquia'),('13011','13','Atlapexco'),('13012','13','Atotonilco el Grande'),('13013','13','Atotonilco de Tula'),
  ('13014','13','Calnali'),('13015','13','Cardonal'),('13016','13','Cuautepec de Hinojosa'),('13017','13','Chapantongo'),('13018','13','Chapulhuacán'),('13019','13','Chilcuautla'),
  ('13020','13','Eloxochitlán'),('13021','13','Emiliano Zapata'),('13022','13','Epazoyucan'),('13023','13','Francisco I. Madero'),('13024','13','Huasca de Ocampo'),('13025','13','Huautla'),
  ('13026','13','Huazalingo'),('13027','13','Huehuetla'),('13028','13','Huejutla de Reyes'),('13029','13','Huichapan'),('13030','13','Ixmiquilpan'),('13031','13','Jacala de Ledezma'),
  ('13032','13','Jaltocán'),('13033','13','Juárez Hidalgo'),('13034','13','Lolotla'),('13035','13','Metepec'),('13036','13','San Agustín Metzquititlán'),('13037','13','Metztitlán'),
  ('13038','13','Mineral del Chico'),('13039','13','Mineral del Monte'),('13040','13','La Misión'),('13041','13','Mixquiahuala de Juárez'),('13042','13','Molango de Escamilla'),('13043','13','Nicolás Flores'),
  ('13044','13','Nopala de Villagrán'),('13045','13','Omitlán de Juárez'),('13046','13','San Felipe Orizatlán'),('13047','13','Pacula'),('13048','13','Pachuca de Soto'),('13049','13','Pisaflores'),
  ('13050','13','Progreso de Obregón'),('13051','13','Mineral de la Reforma'),('13052','13','San Agustín Tlaxiaca'),('13053','13','San Bartolo Tutotepec'),('13054','13','San Salvador'),('13055','13','Santiago de Anaya'),
  ('13056','13','Santiago Tulantepec de Lugo Guerrero'),('13057','13','Singuilucan'),('13058','13','Tasquillo'),('13059','13','Tecozautla'),('13060','13','Tenango de Doria'),('13061','13','Tepeapulco'),
  ('13062','13','Tepehuacán de Guerrero'),('13063','13','Tepeji del Río de Ocampo'),('13064','13','Tepetitlán'),('13065','13','Tetepango'),('13066','13','Villa de Tezontepec'),('13067','13','Tezontepec de Aldama'),
  ('13068','13','Tianguistengo'),('13069','13','Tizayuca'),('13070','13','Tlahuelilpan'),('13071','13','Tlahuiltepa'),('13072','13','Tlanalapa'),('13073','13','Tlanchinol'),
  ('13074','13','Tlaxcoapan'),('13075','13','Tolcayuca'),('13076','13','Tula de Allende'),('13077','13','Tulancingo de Bravo'),('13078','13','Xochiatipan'),('13079','13','Xochicoatlán'),
  ('13080','13','Yahualica'),('13081','13','Zacualtipán de Ángeles'),('13082','13','Zapotlán de Juárez'),('13083','13','Zempoala'),('13084','13','Zimapán'),('14001','14','Acatic'),
  ('14002','14','Acatlán de Juárez'),('14003','14','Ahualulco de Mercado'),('14004','14','Amacueca'),('14005','14','Amatitán'),('14006','14','Ameca'),('14007','14','San Juanito de Escobedo'),
  ('14008','14','Arandas'),('14009','14','El Arenal'),('14010','14','Atemajac de Brizuela'),('14011','14','Atengo'),('14012','14','Atenguillo'),('14013','14','Atotonilco el Alto'),
  ('14014','14','Atoyac'),('14015','14','Autlán de Navarro'),('14016','14','Ayotlán'),('14017','14','Ayutla'),('14018','14','La Barca'),('14019','14','Bolaños'),
  ('14020','14','Cabo Corrientes'),('14021','14','Casimiro Castillo'),('14022','14','Cihuatlán'),('14023','14','Zapotlán el Grande'),('14024','14','Cocula'),('14025','14','Colotlán'),
  ('14026','14','Concepción de Buenos Aires'),('14027','14','Cuautitlán de García Barragán'),('14028','14','Cuautla'),('14029','14','Cuquío'),('14030','14','Chapala'),('14031','14','Chimaltitán'),
  ('14032','14','Chiquilistlán'),('14033','14','Degollado'),('14034','14','Ejutla'),('14035','14','Encarnación de Díaz'),('14036','14','Etzatlán'),('14037','14','El Grullo'),
  ('14038','14','Guachinango'),('14039','14','Guadalajara'),('14040','14','Hostotipaquillo'),('14041','14','Huejúcar'),('14042','14','Huejuquilla el Alto'),('14043','14','La Huerta'),
  ('14044','14','Ixtlahuacán de los Membrillos'),('14045','14','Ixtlahuacán del Río'),('14046','14','Jalostotitlán'),('14047','14','Jamay'),('14048','14','Jesús María'),('14049','14','Jilotlán de los Dolores'),
  ('14050','14','Jocotepec'),('14051','14','Juanacatlán'),('14052','14','Juchitlán'),('14053','14','Lagos de Moreno'),('14054','14','El Limón'),('14055','14','Magdalena'),
  ('14056','14','Santa María del Oro'),('14057','14','La Manzanilla de la Paz'),('14058','14','Mascota'),('14059','14','Mazamitla'),('14060','14','Mexticacán'),('14061','14','Mezquitic'),
  ('14062','14','Mixtlán'),('14063','14','Ocotlán'),('14064','14','Ojuelos de Jalisco'),('14065','14','Pihuamo'),('14066','14','Poncitlán'),('14067','14','Puerto Vallarta'),
  ('14068','14','Villa Purificación'),('14069','14','Quitupan'),('14070','14','El Salto'),('14071','14','San Cristóbal de la Barranca'),('14072','14','San Diego de Alejandría'),('14073','14','San Juan de los Lagos'),
  ('14074','14','San Julián'),('14075','14','San Marcos'),('14076','14','San Martín de Bolaños'),('14077','14','San Martín Hidalgo'),('14078','14','San Miguel el Alto'),('14079','14','Gómez Farías'),
  ('14080','14','San Sebastián del Oeste'),('14081','14','Santa María de los Ángeles'),('14082','14','Sayula'),('14083','14','Tala'),('14084','14','Talpa de Allende'),('14085','14','Tamazula de Gordiano'),
  ('14086','14','Tapalpa'),('14087','14','Tecalitlán'),('14088','14','Tecolotlán'),('14089','14','Techaluta de Montenegro'),('14090','14','Tenamaxtlán'),('14091','14','Teocaltiche'),
  ('14092','14','Teocuitatlán de Corona'),('14093','14','Tepatitlán de Morelos'),('14094','14','Tequila'),('14095','14','Teuchitlán'),('14096','14','Tizapán el Alto'),('14097','14','Tlajomulco de Zúñiga'),
  ('14098','14','San Pedro Tlaquepaque'),('14099','14','Tolimán'),('14100','14','Tomatlán'),('14101','14','Tonalá'),('14102','14','Tonaya'),('14103','14','Tonila'),
  ('14104','14','Totatiche'),('14105','14','Tototlán'),('14106','14','Tuxcacuesco'),('14107','14','Tuxcueca'),('14108','14','Tuxpan'),('14109','14','Unión de San Antonio'),
  ('14110','14','Unión de Tula'),('14111','14','Valle de Guadalupe'),('14112','14','Valle de Juárez'),('14113','14','San Gabriel'),('14114','14','Villa Corona'),('14115','14','Villa Guerrero'),
  ('14116','14','Villa Hidalgo'),('14117','14','Cañadas de Obregón'),('14118','14','Yahualica de González Gallo'),('14119','14','Zacoalco de Torres'),('14120','14','Zapopan'),('14121','14','Zapotiltic'),
  ('14122','14','Zapotitlán de Vadillo'),('14123','14','Zapotlán del Rey'),('14124','14','Zapotlanejo'),('14125','14','San Ignacio Cerro Gordo'),('15001','15','Acambay de Ruíz Castañeda'),('15002','15','Acolman'),
  ('15003','15','Aculco'),('15004','15','Almoloya de Alquisiras'),('15005','15','Almoloya de Juárez'),('15006','15','Almoloya del Río'),('15007','15','Amanalco'),('15008','15','Amatepec'),
  ('15009','15','Amecameca'),('15010','15','Apaxco'),('15011','15','Atenco'),('15012','15','Atizapán'),('15013','15','Atizapán de Zaragoza'),('15014','15','Atlacomulco'),
  ('15015','15','Atlautla'),('15016','15','Axapusco'),('15017','15','Ayapango'),('15018','15','Calimaya'),('15019','15','Capulhuac'),('15020','15','Coacalco de Berriozábal'),
  ('15021','15','Coatepec Harinas'),('15022','15','Cocotitlán'),('15023','15','Coyotepec'),('15024','15','Cuautitlán'),('15025','15','Chalco'),('15026','15','Chapa de Mota'),
  ('15027','15','Chapultepec'),('15028','15','Chiautla'),('15029','15','Chicoloapan'),('15030','15','Chiconcuac'),('15031','15','Chimalhuacán'),('15032','15','Donato Guerra'),
  ('15033','15','Ecatepec de Morelos'),('15034','15','Ecatzingo'),('15035','15','Huehuetoca'),('15036','15','Hueypoxtla'),('15037','15','Huixquilucan'),('15038','15','Isidro Fabela'),
  ('15039','15','Ixtapaluca'),('15040','15','Ixtapan de la Sal'),('15041','15','Ixtapan del Oro'),('15042','15','Ixtlahuaca'),('15043','15','Xalatlaco'),('15044','15','Jaltenco'),
  ('15045','15','Jilotepec'),('15046','15','Jilotzingo'),('15047','15','Jiquipilco'),('15048','15','Jocotitlán'),('15049','15','Joquicingo'),('15050','15','Juchitepec'),
  ('15051','15','Lerma'),('15052','15','Malinalco'),('15053','15','Melchor Ocampo'),('15054','15','Metepec'),('15055','15','Mexicaltzingo'),('15056','15','Morelos'),
  ('15057','15','Naucalpan de Juárez'),('15058','15','Nezahualcóyotl'),('15059','15','Nextlalpan'),('15060','15','Nicolás Romero'),('15061','15','Nopaltepec'),('15062','15','Ocoyoacac'),
  ('15063','15','Ocuilan'),('15064','15','El Oro'),('15065','15','Otumba'),('15066','15','Otzoloapan'),('15067','15','Otzolotepec'),('15068','15','Ozumba'),
  ('15069','15','Papalotla'),('15070','15','La Paz'),('15071','15','Polotitlán'),('15072','15','Rayón'),('15073','15','San Antonio la Isla'),('15074','15','San Felipe del Progreso'),
  ('15075','15','San Martín de las Pirámides'),('15076','15','San Mateo Atenco'),('15077','15','San Simón de Guerrero'),('15078','15','Santo Tomás'),('15079','15','Soyaniquilpan de Juárez'),('15080','15','Sultepec'),
  ('15081','15','Tecámac'),('15082','15','Tejupilco'),('15083','15','Temamatla'),('15084','15','Temascalapa'),('15085','15','Temascalcingo'),('15086','15','Temascaltepec'),
  ('15087','15','Temoaya'),('15088','15','Tenancingo'),('15089','15','Tenango del Aire'),('15090','15','Tenango del Valle'),('15091','15','Teoloyucan'),('15092','15','Teotihuacán'),
  ('15093','15','Tepetlaoxtoc'),('15094','15','Tepetlixpa'),('15095','15','Tepotzotlán'),('15096','15','Tequixquiac'),('15097','15','Texcaltitlán'),('15098','15','Texcalyacac'),
  ('15099','15','Texcoco'),('15100','15','Tezoyuca'),('15101','15','Tianguistenco'),('15102','15','Timilpan'),('15103','15','Tlalmanalco'),('15104','15','Tlalnepantla de Baz'),
  ('15105','15','Tlatlaya'),('15106','15','Toluca'),('15107','15','Tonatico'),('15108','15','Tultepec'),('15109','15','Tultitlán'),('15110','15','Valle de Bravo'),
  ('15111','15','Villa de Allende'),('15112','15','Villa del Carbón'),('15113','15','Villa Guerrero'),('15114','15','Villa Victoria'),('15115','15','Xonacatlán'),('15116','15','Zacazonapan'),
  ('15117','15','Zacualpan'),('15118','15','Zinacantepec'),('15119','15','Zumpahuacán'),('15120','15','Zumpango'),('15121','15','Cuautitlán Izcalli'),('15122','15','Valle de Chalco Solidaridad'),
  ('15123','15','Luvianos'),('15124','15','San José del Rincón'),('15125','15','Tonanitla'),('16001','16','Acuitzio'),('16002','16','Aguililla'),('16003','16','Álvaro Obregón'),
  ('16004','16','Angamacutiro'),('16005','16','Angangueo'),('16006','16','Apatzingán'),('16007','16','Aporo'),('16008','16','Aquila'),('16009','16','Ario'),
  ('16010','16','Arteaga'),('16011','16','Briseñas'),('16012','16','Buenavista'),('16013','16','Carácuaro'),('16014','16','Coahuayana'),('16015','16','Coalcomán de Vázquez Pallares'),
  ('16016','16','Coeneo'),('16017','16','Contepec'),('16018','16','Copándaro'),('16019','16','Cotija'),('16020','16','Cuitzeo'),('16021','16','Charapan'),
  ('16022','16','Charo'),('16023','16','Chavinda'),('16024','16','Cherán'),('16025','16','Chilchota'),('16026','16','Chinicuila'),('16027','16','Chucándiro'),
  ('16028','16','Churintzio'),('16029','16','Churumuco'),('16030','16','Ecuandureo'),('16031','16','Epitacio Huerta'),('16032','16','Erongarícuaro'),('16033','16','Gabriel Zamora'),
  ('16034','16','Hidalgo'),('16035','16','La Huacana'),('16036','16','Huandacareo'),('16037','16','Huaniqueo'),('16038','16','Huetamo'),('16039','16','Huiramba'),
  ('16040','16','Indaparapeo'),('16041','16','Irimbo'),('16042','16','Ixtlán'),('16043','16','Jacona'),('16044','16','Jiménez'),('16045','16','Jiquilpan'),
  ('16046','16','Juárez'),('16047','16','Jungapeo'),('16048','16','Lagunillas'),('16049','16','Madero'),('16050','16','Maravatío'),('16051','16','Marcos Castellanos'),
  ('16052','16','Lázaro Cárdenas'),('16053','16','Morelia'),('16054','16','Morelos'),('16055','16','Múgica'),('16056','16','Nahuatzen'),('16057','16','Nocupétaro'),
  ('16058','16','Nuevo Parangaricutiro'),('16059','16','Nuevo Urecho'),('16060','16','Numarán'),('16061','16','Ocampo'),('16062','16','Pajacuarán'),('16063','16','Panindícuaro'),
  ('16064','16','Parácuaro'),('16065','16','Paracho'),('16066','16','Pátzcuaro'),('16067','16','Penjamillo'),('16068','16','Peribán'),('16069','16','La Piedad'),
  ('16070','16','Purépero'),('16071','16','Puruándiro'),('16072','16','Queréndaro'),('16073','16','Quiroga'),('16074','16','Cojumatlán de Régules'),('16075','16','Los Reyes'),
  ('16076','16','Sahuayo'),('16077','16','San Lucas'),('16078','16','Santa Ana Maya'),('16079','16','Salvador Escalante'),('16080','16','Senguio'),('16081','16','Susupuato'),
  ('16082','16','Tacámbaro'),('16083','16','Tancítaro'),('16084','16','Tangamandapio'),('16085','16','Tangancícuaro'),('16086','16','Tanhuato'),('16087','16','Taretan'),
  ('16088','16','Tarímbaro'),('16089','16','Tepalcatepec'),('16090','16','Tingambato'),('16091','16','Tingüindín'),('16092','16','Tiquicheo de Nicolás Romero'),('16093','16','Tlalpujahua'),
  ('16094','16','Tlazazalca'),('16095','16','Tocumbo'),('16096','16','Tumbiscatío'),('16097','16','Turicato'),('16098','16','Tuxpan'),('16099','16','Tuzantla'),
  ('16100','16','Tzintzuntzan'),('16101','16','Tzitzio'),('16102','16','Uruapan'),('16103','16','Venustiano Carranza'),('16104','16','Villamar'),('16105','16','Vista Hermosa'),
  ('16106','16','Yurécuaro'),('16107','16','Zacapu'),('16108','16','Zamora'),('16109','16','Zináparo'),('16110','16','Zinapécuaro'),('16111','16','Ziracuaretiro'),
  ('16112','16','Zitácuaro'),('16113','16','José Sixto Verduzco'),('17001','17','Amacuzac'),('17002','17','Atlatlahucan'),('17003','17','Axochiapan'),('17004','17','Ayala'),
  ('17005','17','Coatlán del Río'),('17006','17','Cuautla'),('17007','17','Cuernavaca'),('17008','17','Emiliano Zapata'),('17009','17','Huitzilac'),('17010','17','Jantetelco'),
  ('17011','17','Jiutepec'),('17012','17','Jojutla'),('17013','17','Jonacatepec de Leandro Valle'),('17014','17','Mazatepec'),('17015','17','Miacatlán'),('17016','17','Ocuituco'),
  ('17017','17','Puente de Ixtla'),('17018','17','Temixco'),('17019','17','Tepalcingo'),('17020','17','Tepoztlán'),('17021','17','Tetecala'),('17022','17','Tetela del Volcán'),
  ('17023','17','Tlalnepantla'),('17024','17','Tlaltizapán de Zapata'),('17025','17','Tlaquiltenango'),('17026','17','Tlayacapan'),('17027','17','Totolapan'),('17028','17','Xochitepec'),
  ('17029','17','Yautepec'),('17030','17','Yecapixtla'),('17031','17','Zacatepec'),('17032','17','Zacualpan de Amilpas'),('17033','17','Temoac'),('17034','17','Coatetelco'),
  ('17035','17','Xoxocotla'),('17036','17','Hueyapan'),('18001','18','Acaponeta'),('18002','18','Ahuacatlán'),('18003','18','Amatlán de Cañas'),('18004','18','Compostela'),
  ('18005','18','Huajicori'),('18006','18','Ixtlán del Río'),('18007','18','Jala'),('18008','18','Xalisco'),('18009','18','Del Nayar'),('18010','18','Rosamorada'),
  ('18011','18','Ruíz'),('18012','18','San Blas'),('18013','18','San Pedro Lagunillas'),('18014','18','Santa María del Oro'),('18015','18','Santiago Ixcuintla'),('18016','18','Tecuala'),
  ('18017','18','Tepic'),('18018','18','Tuxpan'),('18019','18','La Yesca'),('18020','18','Bahía de Banderas'),('19001','19','Abasolo'),('19002','19','Agualeguas'),
  ('19003','19','Los Aldamas'),('19004','19','Allende'),('19005','19','Anáhuac'),('19006','19','Apodaca'),('19007','19','Aramberri'),('19008','19','Bustamante'),
  ('19009','19','Cadereyta Jiménez'),('19010','19','El Carmen'),('19011','19','Cerralvo'),('19012','19','Ciénega de Flores'),('19013','19','China'),('19014','19','Doctor Arroyo'),
  ('19015','19','Doctor Coss'),('19016','19','Doctor González'),('19017','19','Galeana'),('19018','19','García'),('19019','19','San Pedro Garza García'),('19020','19','General Bravo'),
  ('19021','19','General Escobedo'),('19022','19','General Terán'),('19023','19','General Treviño'),('19024','19','General Zaragoza'),('19025','19','General Zuazua'),('19026','19','Guadalupe'),
  ('19027','19','Los Herreras'),('19028','19','Higueras'),('19029','19','Hualahuises'),('19030','19','Iturbide'),('19031','19','Juárez'),('19032','19','Lampazos de Naranjo'),
  ('19033','19','Linares'),('19034','19','Marín'),('19035','19','Melchor Ocampo'),('19036','19','Mier y Noriega'),('19037','19','Mina'),('19038','19','Montemorelos'),
  ('19039','19','Monterrey'),('19040','19','Parás'),('19041','19','Pesquería'),('19042','19','Los Ramones'),('19043','19','Rayones'),('19044','19','Sabinas Hidalgo'),
  ('19045','19','Salinas Victoria'),('19046','19','San Nicolás de los Garza'),('19047','19','Hidalgo'),('19048','19','Santa Catarina'),('19049','19','Santiago'),('19050','19','Vallecillo'),
  ('19051','19','Villaldama'),('20001','20','Abejones'),('20002','20','Acatlán de Pérez Figueroa'),('20003','20','Asunción Cacalotepec'),('20004','20','Asunción Cuyotepeji'),('20005','20','Asunción Ixtaltepec'),
  ('20006','20','Asunción Nochixtlán'),('20007','20','Asunción Ocotlán'),('20008','20','Asunción Tlacolulita'),('20009','20','Ayotzintepec'),('20010','20','El Barrio de la Soledad'),('20011','20','Calihualá'),
  ('20012','20','Candelaria Loxicha'),('20013','20','Ciénega de Zimatlán'),('20014','20','Ciudad Ixtepec'),('20015','20','Coatecas Altas'),('20016','20','Coicoyán de las Flores'),('20017','20','La Compañía'),
  ('20018','20','Concepción Buenavista'),('20019','20','Concepción Pápalo'),('20020','20','Constancia del Rosario'),('20021','20','Cosolapa'),('20022','20','Cosoltepec'),('20023','20','Cuilápam de Guerrero'),
  ('20024','20','Cuyamecalco Villa de Zaragoza'),('20025','20','Chahuites'),('20026','20','Chalcatongo de Hidalgo'),('20027','20','Chiquihuitlán de Benito Juárez'),('20028','20','Heroica Ciudad de Ejutla de Crespo'),('20029','20','Eloxochitlán de Flores Magón'),
  ('20030','20','El Espinal'),('20031','20','Tamazulápam del Espíritu Santo'),('20032','20','Fresnillo de Trujano'),('20033','20','Guadalupe Etla'),('20034','20','Guadalupe de Ramírez'),('20035','20','Guelatao de Juárez'),
  ('20036','20','Guevea de Humboldt'),('20037','20','Mesones Hidalgo'),('20038','20','Villa Hidalgo Yalálag'),('20039','20','Heroica Ciudad de Huajuapan de León'),('20040','20','Huautepec'),('20041','20','Huautla de Jiménez'),
  ('20042','20','Ixtlán de Juárez'),('20043','20','Juchitán de Zaragoza'),('20044','20','Loma Bonita'),('20045','20','Magdalena Apasco'),('20046','20','Magdalena Jaltepec'),('20047','20','Santa Magdalena Jicotlán'),
  ('20048','20','Magdalena Mixtepec'),('20049','20','Magdalena Ocotlán'),('20050','20','Magdalena Peñasco'),('20051','20','Magdalena Teitipac'),('20052','20','Magdalena Tequisistlán'),('20053','20','Magdalena Tlacotepec'),
  ('20054','20','Magdalena Zahuatlán'),('20055','20','Mariscala de Juárez'),('20056','20','Mártires de Tacubaya'),('20057','20','Matías Romero Avendaño'),('20058','20','Mazatlán Villa de Flores'),('20059','20','Miahuatlán de Porfirio Díaz'),
  ('20060','20','Mixistlán de la Reforma'),('20061','20','Monjas'),('20062','20','Natividad'),('20063','20','Nazareno Etla'),('20064','20','Nejapa de Madero'),('20065','20','Ixpantepec Nieves'),
  ('20066','20','Santiago Niltepec'),('20067','20','Oaxaca de Juárez'),('20068','20','Ocotlán de Morelos'),('20069','20','La Pe'),('20070','20','Pinotepa de Don Luis'),('20071','20','Pluma Hidalgo'),
  ('20072','20','San José del Progreso'),('20073','20','Putla Villa de Guerrero'),('20074','20','Santa Catarina Quioquitani'),('20075','20','Reforma de Pineda'),('20076','20','La Reforma'),('20077','20','Reyes Etla'),
  ('20078','20','Rojas de Cuauhtémoc'),('20079','20','Salina Cruz'),('20080','20','San Agustín Amatengo'),('20081','20','San Agustín Atenango'),('20082','20','San Agustín Chayuco'),('20083','20','San Agustín de las Juntas'),
  ('20084','20','San Agustín Etla'),('20085','20','San Agustín Loxicha'),('20086','20','San Agustín Tlacotepec'),('20087','20','San Agustín Yatareni'),('20088','20','San Andrés Cabecera Nueva'),('20089','20','San Andrés Dinicuiti'),
  ('20090','20','San Andrés Huaxpaltepec'),('20091','20','San Andrés Huayápam'),('20092','20','San Andrés Ixtlahuaca'),('20093','20','San Andrés Lagunas'),('20094','20','San Andrés Nuxiño'),('20095','20','San Andrés Paxtlán'),
  ('20096','20','San Andrés Sinaxtla'),('20097','20','San Andrés Solaga'),('20098','20','San Andrés Teotilálpam'),('20099','20','San Andrés Tepetlapa'),('20100','20','San Andrés Yaá'),('20101','20','San Andrés Zabache'),
  ('20102','20','San Andrés Zautla'),('20103','20','San Antonino Castillo Velasco'),('20104','20','San Antonino el Alto'),('20105','20','San Antonino Monte Verde'),('20106','20','San Antonio Acutla'),('20107','20','San Antonio de la Cal'),
  ('20108','20','San Antonio Huitepec'),('20109','20','San Antonio Nanahuatípam'),('20110','20','San Antonio Sinicahua'),('20111','20','San Antonio Tepetlapa'),('20112','20','San Baltazar Chichicápam'),('20113','20','San Baltazar Loxicha'),
  ('20114','20','San Baltazar Yatzachi el Bajo'),('20115','20','San Bartolo Coyotepec'),('20116','20','San Bartolomé Ayautla'),('20117','20','San Bartolomé Loxicha'),('20118','20','San Bartolomé Quialana'),('20119','20','San Bartolomé Yucuañe'),
  ('20120','20','San Bartolomé Zoogocho'),('20121','20','San Bartolo Soyaltepec'),('20122','20','San Bartolo Yautepec'),('20123','20','San Bernardo Mixtepec'),('20124','20','Heroica Villa de San Blas Atempa'),('20125','20','San Carlos Yautepec'),
  ('20126','20','San Cristóbal Amatlán'),('20127','20','San Cristóbal Amoltepec'),('20128','20','San Cristóbal Lachirioag'),('20129','20','San Cristóbal Suchixtlahuaca'),('20130','20','San Dionisio del Mar'),('20131','20','San Dionisio Ocotepec'),
  ('20132','20','San Dionisio Ocotlán'),('20133','20','San Esteban Atatlahuca'),('20134','20','San Felipe Jalapa de Díaz'),('20135','20','San Felipe Tejalápam'),('20136','20','San Felipe Usila'),('20137','20','San Francisco Cahuacuá'),
  ('20138','20','San Francisco Cajonos'),('20139','20','San Francisco Chapulapa'),('20140','20','San Francisco Chindúa'),('20141','20','San Francisco del Mar'),('20142','20','San Francisco Huehuetlán'),('20143','20','San Francisco Ixhuatán'),
  ('20144','20','San Francisco Jaltepetongo'),('20145','20','San Francisco Lachigoló'),('20146','20','San Francisco Logueche'),('20147','20','San Francisco Nuxaño'),('20148','20','San Francisco Ozolotepec'),('20149','20','San Francisco Sola'),
  ('20150','20','San Francisco Telixtlahuaca'),('20151','20','San Francisco Teopan'),('20152','20','San Francisco Tlapancingo'),('20153','20','San Gabriel Mixtepec'),('20154','20','San Ildefonso Amatlán'),('20155','20','San Ildefonso Sola'),
  ('20156','20','San Ildefonso Villa Alta'),('20157','20','San Jacinto Amilpas'),('20158','20','San Jacinto Tlacotepec'),('20159','20','San Jerónimo Coatlán'),('20160','20','San Jerónimo Silacayoapilla'),('20161','20','San Jerónimo Sosola'),
  ('20162','20','San Jerónimo Taviche'),('20163','20','San Jerónimo Tecóatl'),('20164','20','San Jorge Nuchita'),('20165','20','San José Ayuquila'),('20166','20','San José Chiltepec'),('20167','20','San José del Peñasco'),
  ('20168','20','San José Estancia Grande'),('20169','20','San José Independencia'),('20170','20','San José Lachiguiri'),('20171','20','San José Tenango'),('20172','20','San Juan Achiutla'),('20173','20','San Juan Atepec'),
  ('20174','20','Ánimas Trujano'),('20175','20','San Juan Bautista Atatlahuca'),('20176','20','San Juan Bautista Coixtlahuaca'),('20177','20','San Juan Bautista Cuicatlán'),('20178','20','San Juan Bautista Guelache'),('20179','20','San Juan Bautista Jayacatlán'),
  ('20180','20','San Juan Bautista Lo de Soto'),('20181','20','San Juan Bautista Suchitepec'),('20182','20','San Juan Bautista Tlacoatzintepec'),('20183','20','San Juan Bautista Tlachichilco'),('20184','20','San Juan Bautista Tuxtepec'),('20185','20','San Juan Cacahuatepec'),
  ('20186','20','San Juan Cieneguilla'),('20187','20','San Juan Coatzóspam'),('20188','20','San Juan Colorado'),('20189','20','San Juan Comaltepec'),('20190','20','San Juan Cotzocón'),('20191','20','San Juan Chicomezúchil'),
  ('20192','20','San Juan Chilateca'),('20193','20','San Juan del Estado'),('20194','20','San Juan del Río'),('20195','20','San Juan Diuxi'),('20196','20','San Juan Evangelista Analco'),('20197','20','San Juan Guelavía'),
  ('20198','20','San Juan Guichicovi'),('20199','20','San Juan Ihualtepec'),('20200','20','San Juan Juquila Mixes'),('20201','20','San Juan Juquila Vijanos'),('20202','20','San Juan Lachao'),('20203','20','San Juan Lachigalla'),
  ('20204','20','San Juan Lajarcia'),('20205','20','San Juan Lalana'),('20206','20','San Juan de los Cués'),('20207','20','San Juan Mazatlán'),('20208','20','San Juan Mixtepec'),('20209','20','San Juan Mixtepec'),
  ('20210','20','San Juan Ñumí'),('20211','20','San Juan Ozolotepec'),('20212','20','San Juan Petlapa'),('20213','20','San Juan Quiahije'),('20214','20','San Juan Quiotepec'),('20215','20','San Juan Sayultepec'),
  ('20216','20','San Juan Tabaá'),('20217','20','San Juan Tamazola'),('20218','20','San Juan Teita'),('20219','20','San Juan Teitipac'),('20220','20','San Juan Tepeuxila'),('20221','20','San Juan Teposcolula'),
  ('20222','20','San Juan Yaeé'),('20223','20','San Juan Yatzona'),('20224','20','San Juan Yucuita'),('20225','20','San Lorenzo'),('20226','20','San Lorenzo Albarradas'),('20227','20','San Lorenzo Cacaotepec'),
  ('20228','20','San Lorenzo Cuaunecuiltitla'),('20229','20','San Lorenzo Texmelúcan'),('20230','20','San Lorenzo Victoria'),('20231','20','San Lucas Camotlán'),('20232','20','San Lucas Ojitlán'),('20233','20','San Lucas Quiaviní'),
  ('20234','20','San Lucas Zoquiápam'),('20235','20','San Luis Amatlán'),('20236','20','San Marcial Ozolotepec'),('20237','20','San Marcos Arteaga'),('20238','20','San Martín de los Cansecos'),('20239','20','San Martín Huamelúlpam'),
  ('20240','20','San Martín Itunyoso'),('20241','20','San Martín Lachilá'),('20242','20','San Martín Peras'),('20243','20','San Martín Tilcajete'),('20244','20','San Martín Toxpalan'),('20245','20','San Martín Zacatepec'),
  ('20246','20','San Mateo Cajonos'),('20247','20','Capulálpam de Méndez'),('20248','20','San Mateo del Mar'),('20249','20','San Mateo Yoloxochitlán'),('20250','20','San Mateo Etlatongo'),('20251','20','San Mateo Nejápam'),
  ('20252','20','San Mateo Peñasco'),('20253','20','San Mateo Piñas'),('20254','20','San Mateo Río Hondo'),('20255','20','San Mateo Sindihui'),('20256','20','San Mateo Tlapiltepec'),('20257','20','San Melchor Betaza'),
  ('20258','20','San Miguel Achiutla'),('20259','20','San Miguel Ahuehuetitlán'),('20260','20','San Miguel Aloápam'),('20261','20','San Miguel Amatitlán'),('20262','20','San Miguel Amatlán'),('20263','20','San Miguel Coatlán'),
  ('20264','20','San Miguel Chicahua'),('20265','20','San Miguel Chimalapa'),('20266','20','San Miguel del Puerto'),('20267','20','San Miguel del Río'),('20268','20','San Miguel Ejutla'),('20269','20','San Miguel el Grande'),
  ('20270','20','San Miguel Huautla'),('20271','20','San Miguel Mixtepec'),('20272','20','San Miguel Panixtlahuaca'),('20273','20','San Miguel Peras'),('20274','20','San Miguel Piedras'),('20275','20','San Miguel Quetzaltepec'),
  ('20276','20','San Miguel Santa Flor'),('20277','20','Villa Sola de Vega'),('20278','20','San Miguel Soyaltepec'),('20279','20','San Miguel Suchixtepec'),('20280','20','Villa Talea de Castro'),('20281','20','San Miguel Tecomatlán'),
  ('20282','20','San Miguel Tenango'),('20283','20','San Miguel Tequixtepec'),('20284','20','San Miguel Tilquiápam'),('20285','20','San Miguel Tlacamama'),('20286','20','San Miguel Tlacotepec'),('20287','20','San Miguel Tulancingo'),
  ('20288','20','San Miguel Yotao'),('20289','20','San Nicolás'),('20290','20','San Nicolás Hidalgo'),('20291','20','San Pablo Coatlán'),('20292','20','San Pablo Cuatro Venados'),('20293','20','San Pablo Etla'),
  ('20294','20','San Pablo Huitzo'),('20295','20','San Pablo Huixtepec'),('20296','20','San Pablo Macuiltianguis'),('20297','20','San Pablo Tijaltepec'),('20298','20','San Pablo Villa de Mitla'),('20299','20','San Pablo Yaganiza'),
  ('20300','20','San Pedro Amuzgos'),('20301','20','San Pedro Apóstol'),('20302','20','San Pedro Atoyac'),('20303','20','San Pedro Cajonos'),('20304','20','San Pedro Coxcaltepec Cántaros'),('20305','20','San Pedro Comitancillo'),
  ('20306','20','San Pedro el Alto'),('20307','20','San Pedro Huamelula'),('20308','20','San Pedro Huilotepec'),('20309','20','San Pedro Ixcatlán'),('20310','20','San Pedro Ixtlahuaca'),('20311','20','San Pedro Jaltepetongo'),
  ('20312','20','San Pedro Jicayán'),('20313','20','San Pedro Jocotipac'),('20314','20','San Pedro Juchatengo'),('20315','20','San Pedro Mártir'),('20316','20','San Pedro Mártir Quiechapa'),('20317','20','San Pedro Mártir Yucuxaco'),
  ('20318','20','San Pedro Mixtepec'),('20319','20','San Pedro Mixtepec'),('20320','20','San Pedro Molinos'),('20321','20','San Pedro Nopala'),('20322','20','San Pedro Ocopetatillo'),('20323','20','San Pedro Ocotepec'),
  ('20324','20','San Pedro Pochutla'),('20325','20','San Pedro Quiatoni'),('20326','20','San Pedro Sochiápam'),('20327','20','San Pedro Tapanatepec'),('20328','20','San Pedro Taviche'),('20329','20','San Pedro Teozacoalco'),
  ('20330','20','San Pedro Teutila'),('20331','20','San Pedro Tidaá'),('20332','20','San Pedro Topiltepec'),('20333','20','San Pedro Totolápam'),('20334','20','Villa de Tututepec'),('20335','20','San Pedro Yaneri'),
  ('20336','20','San Pedro Yólox'),('20337','20','San Pedro y San Pablo Ayutla'),('20338','20','Villa de Etla'),('20339','20','San Pedro y San Pablo Teposcolula'),('20340','20','San Pedro y San Pablo Tequixtepec'),('20341','20','San Pedro Yucunama'),
  ('20342','20','San Raymundo Jalpan'),('20343','20','San Sebastián Abasolo'),('20344','20','San Sebastián Coatlán'),('20345','20','San Sebastián Ixcapa'),('20346','20','San Sebastián Nicananduta'),('20347','20','San Sebastián Río Hondo'),
  ('20348','20','San Sebastián Tecomaxtlahuaca'),('20349','20','San Sebastián Teitipac'),('20350','20','San Sebastián Tutla'),('20351','20','San Simón Almolongas'),('20352','20','San Simón Zahuatlán'),('20353','20','Santa Ana'),
  ('20354','20','Santa Ana Ateixtlahuaca'),('20355','20','Santa Ana Cuauhtémoc'),('20356','20','Santa Ana del Valle'),('20357','20','Santa Ana Tavela'),('20358','20','Santa Ana Tlapacoyan'),('20359','20','Santa Ana Yareni'),
  ('20360','20','Santa Ana Zegache'),('20361','20','Santa Catalina Quierí'),('20362','20','Santa Catarina Cuixtla'),('20363','20','Santa Catarina Ixtepeji'),('20364','20','Santa Catarina Juquila'),('20365','20','Santa Catarina Lachatao'),
  ('20366','20','Santa Catarina Loxicha'),('20367','20','Santa Catarina Mechoacán'),('20368','20','Santa Catarina Minas'),('20369','20','Santa Catarina Quiané'),('20370','20','Santa Catarina Tayata'),('20371','20','Santa Catarina Ticuá'),
  ('20372','20','Santa Catarina Yosonotú'),('20373','20','Santa Catarina Zapoquila'),('20374','20','Santa Cruz Acatepec'),('20375','20','Santa Cruz Amilpas'),('20376','20','Santa Cruz de Bravo'),('20377','20','Santa Cruz Itundujia'),
  ('20378','20','Santa Cruz Mixtepec'),('20379','20','Santa Cruz Nundaco'),('20380','20','Santa Cruz Papalutla'),('20381','20','Santa Cruz Tacache de Mina'),('20382','20','Santa Cruz Tacahua'),('20383','20','Santa Cruz Tayata'),
  ('20384','20','Santa Cruz Xitla'),('20385','20','Santa Cruz Xoxocotlán'),('20386','20','Santa Cruz Zenzontepec'),('20387','20','Santa Gertrudis'),('20388','20','Santa Inés del Monte'),('20389','20','Santa Inés Yatzeche'),
  ('20390','20','Santa Lucía del Camino'),('20391','20','Santa Lucía Miahuatlán'),('20392','20','Santa Lucía Monteverde'),('20393','20','Santa Lucía Ocotlán'),('20394','20','Santa María Alotepec'),('20395','20','Santa María Apazco'),
  ('20396','20','Santa María la Asunción'),('20397','20','Heroica Ciudad de Tlaxiaco'),('20398','20','Ayoquezco de Aldama'),('20399','20','Santa María Atzompa'),('20400','20','Santa María Camotlán'),('20401','20','Santa María Colotepec'),
  ('20402','20','Santa María Cortijo'),('20403','20','Santa María Coyotepec'),('20404','20','Santa María Chachoápam'),('20405','20','Villa de Chilapa de Díaz'),('20406','20','Santa María Chilchotla'),('20407','20','Santa María Chimalapa'),
  ('20408','20','Santa María del Rosario'),('20409','20','Santa María del Tule'),('20410','20','Santa María Ecatepec'),('20411','20','Santa María Guelacé'),('20412','20','Santa María Guienagati'),('20413','20','Santa María Huatulco'),
  ('20414','20','Santa María Huazolotitlán'),('20415','20','Santa María Ipalapa'),('20416','20','Santa María Ixcatlán'),('20417','20','Santa María Jacatepec'),('20418','20','Santa María Jalapa del Marqués'),('20419','20','Santa María Jaltianguis'),
  ('20420','20','Santa María Lachixío'),('20421','20','Santa María Mixtequilla'),('20422','20','Santa María Nativitas'),('20423','20','Santa María Nduayaco'),('20424','20','Santa María Ozolotepec'),('20425','20','Santa María Pápalo'),
  ('20426','20','Santa María Peñoles'),('20427','20','Santa María Petapa'),('20428','20','Santa María Quiegolani'),('20429','20','Santa María Sola'),('20430','20','Santa María Tataltepec'),('20431','20','Santa María Tecomavaca'),
  ('20432','20','Santa María Temaxcalapa'),('20433','20','Santa María Temaxcaltepec'),('20434','20','Santa María Teopoxco'),('20435','20','Santa María Tepantlali'),('20436','20','Santa María Texcatitlán'),('20437','20','Santa María Tlahuitoltepec'),
  ('20438','20','Santa María Tlalixtac'),('20439','20','Santa María Tonameca'),('20440','20','Santa María Totolapilla'),('20441','20','Santa María Xadani'),('20442','20','Santa María Yalina'),('20443','20','Santa María Yavesía'),
  ('20444','20','Santa María Yolotepec'),('20445','20','Santa María Yosoyúa'),('20446','20','Santa María Yucuhiti'),('20447','20','Santa María Zacatepec'),('20448','20','Santa María Zaniza'),('20449','20','Santa María Zoquitlán'),
  ('20450','20','Santiago Amoltepec'),('20451','20','Santiago Apoala'),('20452','20','Santiago Apóstol'),('20453','20','Santiago Astata'),('20454','20','Santiago Atitlán'),('20455','20','Santiago Ayuquililla'),
  ('20456','20','Santiago Cacaloxtepec'),('20457','20','Santiago Camotlán'),('20458','20','Santiago Comaltepec'),('20459','20','Villa de Santiago Chazumba'),('20460','20','Santiago Choápam'),('20461','20','Santiago del Río'),
  ('20462','20','Santiago Huajolotitlán'),('20463','20','Santiago Huauclilla'),('20464','20','Santiago Ihuitlán Plumas'),('20465','20','Santiago Ixcuintepec'),('20466','20','Santiago Ixtayutla'),('20467','20','Santiago Jamiltepec'),
  ('20468','20','Santiago Jocotepec'),('20469','20','Santiago Juxtlahuaca'),('20470','20','Santiago Lachiguiri'),('20471','20','Santiago Lalopa'),('20472','20','Santiago Laollaga'),('20473','20','Santiago Laxopa'),
  ('20474','20','Santiago Llano Grande'),('20475','20','Santiago Matatlán'),('20476','20','Santiago Miltepec'),('20477','20','Santiago Minas'),('20478','20','Santiago Nacaltepec'),('20479','20','Santiago Nejapilla'),
  ('20480','20','Santiago Nundiche'),('20481','20','Santiago Nuyoó'),('20482','20','Santiago Pinotepa Nacional'),('20483','20','Santiago Suchilquitongo'),('20484','20','Santiago Tamazola'),('20485','20','Santiago Tapextla'),
  ('20486','20','Villa Tejúpam de la Unión'),('20487','20','Santiago Tenango'),('20488','20','Santiago Tepetlapa'),('20489','20','Santiago Tetepec'),('20490','20','Santiago Texcalcingo'),('20491','20','Santiago Textitlán'),
  ('20492','20','Santiago Tilantongo'),('20493','20','Santiago Tillo'),('20494','20','Santiago Tlazoyaltepec'),('20495','20','Santiago Xanica'),('20496','20','Santiago Xiacuí'),('20497','20','Santiago Yaitepec'),
  ('20498','20','Santiago Yaveo'),('20499','20','Santiago Yolomécatl'),('20500','20','Santiago Yosondúa'),('20501','20','Santiago Yucuyachi'),('20502','20','Santiago Zacatepec'),('20503','20','Santiago Zoochila'),
  ('20504','20','Nuevo Zoquiápam'),('20505','20','Santo Domingo Ingenio'),('20506','20','Santo Domingo Albarradas'),('20507','20','Santo Domingo Armenta'),('20508','20','Santo Domingo Chihuitán'),('20509','20','Santo Domingo de Morelos'),
  ('20510','20','Santo Domingo Ixcatlán'),('20511','20','Santo Domingo Nuxaá'),('20512','20','Santo Domingo Ozolotepec'),('20513','20','Santo Domingo Petapa'),('20514','20','Santo Domingo Roayaga'),('20515','20','Santo Domingo Tehuantepec'),
  ('20516','20','Santo Domingo Teojomulco'),('20517','20','Santo Domingo Tepuxtepec'),('20518','20','Santo Domingo Tlatayápam'),('20519','20','Santo Domingo Tomaltepec'),('20520','20','Santo Domingo Tonalá'),('20521','20','Santo Domingo Tonaltepec'),
  ('20522','20','Santo Domingo Xagacía'),('20523','20','Santo Domingo Yanhuitlán'),('20524','20','Santo Domingo Yodohino'),('20525','20','Santo Domingo Zanatepec'),('20526','20','Santos Reyes Nopala'),('20527','20','Santos Reyes Pápalo'),
  ('20528','20','Santos Reyes Tepejillo'),('20529','20','Santos Reyes Yucuná'),('20530','20','Santo Tomás Jalieza'),('20531','20','Santo Tomás Mazaltepec'),('20532','20','Santo Tomás Ocotepec'),('20533','20','Santo Tomás Tamazulapan'),
  ('20534','20','San Vicente Coatlán'),('20535','20','San Vicente Lachixío'),('20536','20','San Vicente Nuñú'),('20537','20','Silacayoápam'),('20538','20','Sitio de Xitlapehua'),('20539','20','Soledad Etla'),
  ('20540','20','Villa de Tamazulápam del Progreso'),('20541','20','Tanetze de Zaragoza'),('20542','20','Taniche'),('20543','20','Tataltepec de Valdés'),('20544','20','Teococuilco de Marcos Pérez'),('20545','20','Teotitlán de Flores Magón'),
  ('20546','20','Teotitlán del Valle'),('20547','20','Teotongo'),('20548','20','Tepelmeme Villa de Morelos'),('20549','20','Heroica Villa Tezoatlán de Segura y Luna, Cuna de la Independencia de Oaxaca'),('20550','20','San Jerónimo Tlacochahuaya'),('20551','20','Tlacolula de Matamoros'),
  ('20552','20','Tlacotepec Plumas'),('20553','20','Tlalixtac de Cabrera'),('20554','20','Totontepec Villa de Morelos'),('20555','20','Trinidad Zaachila'),('20556','20','La Trinidad Vista Hermosa'),('20557','20','Unión Hidalgo'),
  ('20558','20','Valerio Trujano'),('20559','20','San Juan Bautista Valle Nacional'),('20560','20','Villa Díaz Ordaz'),('20561','20','Yaxe'),('20562','20','Magdalena Yodocono de Porfirio Díaz'),('20563','20','Yogana'),
  ('20564','20','Yutanduchi de Guerrero'),('20565','20','Villa de Zaachila'),('20566','20','San Mateo Yucutindoo'),('20567','20','Zapotitlán Lagunas'),('20568','20','Zapotitlán Palmas'),('20569','20','Santa Inés de Zaragoza'),
  ('20570','20','Zimatlán de Álvarez'),('21001','21','Acajete'),('21002','21','Acateno'),('21003','21','Acatlán'),('21004','21','Acatzingo'),('21005','21','Acteopan'),
  ('21006','21','Ahuacatlán'),('21007','21','Ahuatlán'),('21008','21','Ahuazotepec'),('21009','21','Ahuehuetitla'),('21010','21','Ajalpan'),('21011','21','Albino Zertuche'),
  ('21012','21','Aljojuca'),('21013','21','Altepexi'),('21014','21','Amixtlán'),('21015','21','Amozoc'),('21016','21','Aquixtla'),('21017','21','Atempan'),
  ('21018','21','Atexcal'),('21019','21','Atlixco'),('21020','21','Atoyatempan'),('21021','21','Atzala'),('21022','21','Atzitzihuacán'),('21023','21','Atzitzintla'),
  ('21024','21','Axutla'),('21025','21','Ayotoxco de Guerrero'),('21026','21','Calpan'),('21027','21','Caltepec'),('21028','21','Camocuautla'),('21029','21','Caxhuacan'),
  ('21030','21','Coatepec'),('21031','21','Coatzingo'),('21032','21','Cohetzala'),('21033','21','Cohuecan'),('21034','21','Coronango'),('21035','21','Coxcatlán'),
  ('21036','21','Coyomeapan'),('21037','21','Coyotepec'),('21038','21','Cuapiaxtla de Madero'),('21039','21','Cuautempan'),('21040','21','Cuautinchán'),('21041','21','Cuautlancingo'),
  ('21042','21','Cuayuca de Andrade'),('21043','21','Cuetzalan del Progreso'),('21044','21','Cuyoaco'),('21045','21','Chalchicomula de Sesma'),('21046','21','Chapulco'),('21047','21','Chiautla'),
  ('21048','21','Chiautzingo'),('21049','21','Chiconcuautla'),('21050','21','Chichiquila'),('21051','21','Chietla'),('21052','21','Chigmecatitlán'),('21053','21','Chignahuapan'),
  ('21054','21','Chignautla'),('21055','21','Chila'),('21056','21','Chila de la Sal'),('21057','21','Honey'),('21058','21','Chilchotla'),('21059','21','Chinantla'),
  ('21060','21','Domingo Arenas'),('21061','21','Eloxochitlán'),('21062','21','Epatlán'),('21063','21','Esperanza'),('21064','21','Francisco Z. Mena'),('21065','21','General Felipe Ángeles'),
  ('21066','21','Guadalupe'),('21067','21','Guadalupe Victoria'),('21068','21','Hermenegildo Galeana'),('21069','21','Huaquechula'),('21070','21','Huatlatlauca'),('21071','21','Huauchinango'),
  ('21072','21','Huehuetla'),('21073','21','Huehuetlán el Chico'),('21074','21','Huejotzingo'),('21075','21','Hueyapan'),('21076','21','Hueytamalco'),('21077','21','Hueytlalpan'),
  ('21078','21','Huitzilan de Serdán'),('21079','21','Huitziltepec'),('21080','21','Atlequizayan'),('21081','21','Ixcamilpa de Guerrero'),('21082','21','Ixcaquixtla'),('21083','21','Ixtacamaxtitlán'),
  ('21084','21','Ixtepec'),('21085','21','Izúcar de Matamoros'),('21086','21','Jalpan'),('21087','21','Jolalpan'),('21088','21','Jonotla'),('21089','21','Jopala'),
  ('21090','21','Juan C. Bonilla'),('21091','21','Juan Galindo'),('21092','21','Juan N. Méndez'),('21093','21','Lafragua'),('21094','21','Libres'),('21095','21','La Magdalena Tlatlauquitepec'),
  ('21096','21','Mazapiltepec de Juárez'),('21097','21','Mixtla'),('21098','21','Molcaxac'),('21099','21','Cañada Morelos'),('21100','21','Naupan'),('21101','21','Nauzontla'),
  ('21102','21','Nealtican'),('21103','21','Nicolás Bravo'),('21104','21','Nopalucan'),('21105','21','Ocotepec'),('21106','21','Ocoyucan'),('21107','21','Olintla'),
  ('21108','21','Oriental'),('21109','21','Pahuatlán'),('21110','21','Palmar de Bravo'),('21111','21','Pantepec'),('21112','21','Petlalcingo'),('21113','21','Piaxtla'),
  ('21114','21','Puebla'),('21115','21','Quecholac'),('21116','21','Quimixtlán'),('21117','21','Rafael Lara Grajales'),('21118','21','Los Reyes de Juárez'),('21119','21','San Andrés Cholula'),
  ('21120','21','San Antonio Cañada'),('21121','21','San Diego la Mesa Tochimiltzingo'),('21122','21','San Felipe Teotlalcingo'),('21123','21','San Felipe Tepatlán'),('21124','21','San Gabriel Chilac'),('21125','21','San Gregorio Atzompa'),
  ('21126','21','San Jerónimo Tecuanipan'),('21127','21','San Jerónimo Xayacatlán'),('21128','21','San José Chiapa'),('21129','21','San José Miahuatlán'),('21130','21','San Juan Atenco'),('21131','21','San Juan Atzompa'),
  ('21132','21','San Martín Texmelucan'),('21133','21','San Martín Totoltepec'),('21134','21','San Matías Tlalancaleca'),('21135','21','San Miguel Ixitlán'),('21136','21','San Miguel Xoxtla'),('21137','21','San Nicolás Buenos Aires'),
  ('21138','21','San Nicolás de los Ranchos'),('21139','21','San Pablo Anicano'),('21140','21','San Pedro Cholula'),('21141','21','San Pedro Yeloixtlahuaca'),('21142','21','San Salvador el Seco'),('21143','21','San Salvador el Verde'),
  ('21144','21','San Salvador Huixcolotla'),('21145','21','San Sebastián Tlacotepec'),('21146','21','Santa Catarina Tlaltempan'),('21147','21','Santa Inés Ahuatempan'),('21148','21','Santa Isabel Cholula'),('21149','21','Santiago Miahuatlán'),
  ('21150','21','Huehuetlán el Grande'),('21151','21','Santo Tomás Hueyotlipan'),('21152','21','Soltepec'),('21153','21','Tecali de Herrera'),('21154','21','Tecamachalco'),('21155','21','Tecomatlán'),
  ('21156','21','Tehuacán'),('21157','21','Tehuitzingo'),('21158','21','Tenampulco'),('21159','21','Teopantlán'),('21160','21','Teotlalco'),('21161','21','Tepanco de López'),
  ('21162','21','Tepango de Rodríguez'),('21163','21','Tepatlaxco de Hidalgo'),('21164','21','Tepeaca'),('21165','21','Tepemaxalco'),('21166','21','Tepeojuma'),('21167','21','Tepetzintla'),
  ('21168','21','Tepexco'),('21169','21','Tepexi de Rodríguez'),('21170','21','Tepeyahualco'),('21171','21','Tepeyahualco de Cuauhtémoc'),('21172','21','Tetela de Ocampo'),('21173','21','Teteles de Ávila Castillo'),
  ('21174','21','Teziutlán'),('21175','21','Tianguismanalco'),('21176','21','Tilapa'),('21177','21','Tlacotepec de Benito Juárez'),('21178','21','Tlacuilotepec'),('21179','21','Tlachichuca'),
  ('21180','21','Tlahuapan'),('21181','21','Tlaltenango'),('21182','21','Tlanepantla'),('21183','21','Tlaola'),('21184','21','Tlapacoya'),('21185','21','Tlapanalá'),
  ('21186','21','Tlatlauquitepec'),('21187','21','Tlaxco'),('21188','21','Tochimilco'),('21189','21','Tochtepec'),('21190','21','Totoltepec de Guerrero'),('21191','21','Tulcingo'),
  ('21192','21','Tuzamapan de Galeana'),('21193','21','Tzicatlacoyan'),('21194','21','Venustiano Carranza'),('21195','21','Vicente Guerrero'),('21196','21','Xayacatlán de Bravo'),('21197','21','Xicotepec'),
  ('21198','21','Xicotlán'),('21199','21','Xiutetelco'),('21200','21','Xochiapulco'),('21201','21','Xochiltepec'),('21202','21','Xochitlán de Vicente Suárez'),('21203','21','Xochitlán Todos Santos'),
  ('21204','21','Yaonáhuac'),('21205','21','Yehualtepec'),('21206','21','Zacapala'),('21207','21','Zacapoaxtla'),('21208','21','Zacatlán'),('21209','21','Zapotitlán'),
  ('21210','21','Zapotitlán de Méndez'),('21211','21','Zaragoza'),('21212','21','Zautla'),('21213','21','Zihuateutla'),('21214','21','Zinacatepec'),('21215','21','Zongozotla'),
  ('21216','21','Zoquiapan'),('21217','21','Zoquitlán'),('22001','22','Amealco de Bonfil'),('22002','22','Pinal de Amoles'),('22003','22','Arroyo Seco'),('22004','22','Cadereyta de Montes'),
  ('22005','22','Colón'),('22006','22','Corregidora'),('22007','22','Ezequiel Montes'),('22008','22','Huimilpan'),('22009','22','Jalpan de Serra'),('22010','22','Landa de Matamoros'),
  ('22011','22','El Marqués'),('22012','22','Pedro Escobedo'),('22013','22','Peñamiller'),('22014','22','Querétaro'),('22015','22','San Joaquín'),('22016','22','San Juan del Río'),
  ('22017','22','Tequisquiapan'),('22018','22','Tolimán'),('23001','23','Cozumel'),('23002','23','Felipe Carrillo Puerto'),('23003','23','Isla Mujeres'),('23004','23','Othón P. Blanco'),
  ('23005','23','Benito Juárez'),('23006','23','José María Morelos'),('23007','23','Lázaro Cárdenas'),('23008','23','Solidaridad'),('23009','23','Tulum'),('23010','23','Bacalar'),
  ('23011','23','Puerto Morelos'),('24001','24','Ahualulco del Sonido 13'),('24002','24','Alaquines'),('24003','24','Aquismón'),('24004','24','Armadillo de los Infante'),('24005','24','Cárdenas'),
  ('24006','24','Catorce'),('24007','24','Cedral'),('24008','24','Cerritos'),('24009','24','Cerro de San Pedro'),('24010','24','Ciudad del Maíz'),('24011','24','Ciudad Fernández'),
  ('24012','24','Tancanhuitz'),('24013','24','Ciudad Valles'),('24014','24','Coxcatlán'),('24015','24','Charcas'),('24016','24','Ebano'),('24017','24','Guadalcázar'),
  ('24018','24','Huehuetlán'),('24019','24','Lagunillas'),('24020','24','Matehuala'),('24021','24','Mexquitic de Carmona'),('24022','24','Moctezuma'),('24023','24','Rayón'),
  ('24024','24','Rioverde'),('24025','24','Salinas'),('24026','24','San Antonio'),('24027','24','San Ciro de Acosta'),('24028','24','San Luis Potosí'),('24029','24','San Martín Chalchicuautla'),
  ('24030','24','San Nicolás Tolentino'),('24031','24','Santa Catarina'),('24032','24','Santa María del Río'),('24033','24','Santo Domingo'),('24034','24','San Vicente Tancuayalab'),('24035','24','Soledad de Graciano Sánchez'),
  ('24036','24','Tamasopo'),('24037','24','Tamazunchale'),('24038','24','Tampacán'),('24039','24','Tampamolón Corona'),('24040','24','Tamuín'),('24041','24','Tanlajás'),
  ('24042','24','Tanquián de Escobedo'),('24043','24','Tierra Nueva'),('24044','24','Vanegas'),('24045','24','Venado'),('24046','24','Villa de Arriaga'),('24047','24','Villa de Guadalupe'),
  ('24048','24','Villa de la Paz'),('24049','24','Villa de Ramos'),('24050','24','Villa de Reyes'),('24051','24','Villa Hidalgo'),('24052','24','Villa Juárez'),('24053','24','Axtla de Terrazas'),
  ('24054','24','Xilitla'),('24055','24','Zaragoza'),('24056','24','Villa de Arista'),('24057','24','Matlapa'),('24058','24','El Naranjo'),('25001','25','Ahome'),
  ('25002','25','Angostura'),('25003','25','Badiraguato'),('25004','25','Concordia'),('25005','25','Cosalá'),('25006','25','Culiacán'),('25007','25','Choix'),
  ('25008','25','Elota'),('25009','25','Escuinapa'),('25010','25','El Fuerte'),('25011','25','Guasave'),('25012','25','Mazatlán'),('25013','25','Mocorito'),
  ('25014','25','Rosario'),('25015','25','Salvador Alvarado'),('25016','25','San Ignacio'),('25017','25','Sinaloa'),('25018','25','Navolato'),('26001','26','Aconchi'),
  ('26002','26','Agua Prieta'),('26003','26','Álamos'),('26004','26','Altar'),('26005','26','Arivechi'),('26006','26','Arizpe'),('26007','26','Atil'),
  ('26008','26','Bacadéhuachi'),('26009','26','Bacanora'),('26010','26','Bacerac'),('26011','26','Bacoachi'),('26012','26','Bácum'),('26013','26','Banámichi'),
  ('26014','26','Baviácora'),('26015','26','Bavispe'),('26016','26','Benjamín Hill'),('26017','26','Caborca'),('26018','26','Cajeme'),('26019','26','Cananea'),
  ('26020','26','Carbó'),('26021','26','La Colorada'),('26022','26','Cucurpe'),('26023','26','Cumpas'),('26024','26','Divisaderos'),('26025','26','Empalme'),
  ('26026','26','Etchojoa'),('26027','26','Fronteras'),('26028','26','Granados'),('26029','26','Guaymas'),('26030','26','Hermosillo'),('26031','26','Huachinera'),
  ('26032','26','Huásabas'),('26033','26','Huatabampo'),('26034','26','Huépac'),('26035','26','Imuris'),('26036','26','Magdalena'),('26037','26','Mazatán'),
  ('26038','26','Moctezuma'),('26039','26','Naco'),('26040','26','Nácori Chico'),('26041','26','Nacozari de García'),('26042','26','Navojoa'),('26043','26','Nogales'),
  ('26044','26','Ónavas'),('26045','26','Opodepe'),('26046','26','Oquitoa'),('26047','26','Pitiquito'),('26048','26','Puerto Peñasco'),('26049','26','Quiriego'),
  ('26050','26','Rayón'),('26051','26','Rosario'),('26052','26','Sahuaripa'),('26053','26','San Felipe de Jesús'),('26054','26','San Javier'),('26055','26','San Luis Río Colorado'),
  ('26056','26','San Miguel de Horcasitas'),('26057','26','San Pedro de la Cueva'),('26058','26','Santa Ana'),('26059','26','Santa Cruz'),('26060','26','Sáric'),('26061','26','Soyopa'),
  ('26062','26','Suaqui Grande'),('26063','26','Tepache'),('26064','26','Trincheras'),('26065','26','Tubutama'),('26066','26','Ures'),('26067','26','Villa Hidalgo'),
  ('26068','26','Villa Pesqueira'),('26069','26','Yécora'),('26070','26','General Plutarco Elías Calles'),('26071','26','Benito Juárez'),('26072','26','San Ignacio Río Muerto'),('27001','27','Balancán'),
  ('27002','27','Cárdenas'),('27003','27','Centla'),('27004','27','Centro'),('27005','27','Comalcalco'),('27006','27','Cunduacán'),('27007','27','Emiliano Zapata'),
  ('27008','27','Huimanguillo'),('27009','27','Jalapa'),('27010','27','Jalpa de Méndez'),('27011','27','Jonuta'),('27012','27','Macuspana'),('27013','27','Nacajuca'),
  ('27014','27','Paraíso'),('27015','27','Tacotalpa'),('27016','27','Teapa'),('27017','27','Tenosique'),('28001','28','Abasolo'),('28002','28','Aldama'),
  ('28003','28','Altamira'),('28004','28','Antiguo Morelos'),('28005','28','Burgos'),('28006','28','Bustamante'),('28007','28','Camargo'),('28008','28','Casas'),
  ('28009','28','Ciudad Madero'),('28010','28','Cruillas'),('28011','28','Gómez Farías'),('28012','28','González'),('28013','28','Güémez'),('28014','28','Guerrero'),
  ('28015','28','Gustavo Díaz Ordaz'),('28016','28','Hidalgo'),('28017','28','Jaumave'),('28018','28','Jiménez'),('28019','28','Llera'),('28020','28','Mainero'),
  ('28021','28','El Mante'),('28022','28','Matamoros'),('28023','28','Méndez'),('28024','28','Mier'),('28025','28','Miguel Alemán'),('28026','28','Miquihuana'),
  ('28027','28','Nuevo Laredo'),('28028','28','Nuevo Morelos'),('28029','28','Ocampo'),('28030','28','Padilla'),('28031','28','Palmillas'),('28032','28','Reynosa'),
  ('28033','28','Río Bravo'),('28034','28','San Carlos'),('28035','28','San Fernando'),('28036','28','San Nicolás'),('28037','28','Soto la Marina'),('28038','28','Tampico'),
  ('28039','28','Tula'),('28040','28','Valle Hermoso'),('28041','28','Victoria'),('28042','28','Villagrán'),('28043','28','Xicoténcatl'),('29001','29','Amaxac de Guerrero'),
  ('29002','29','Apetatitlán de Antonio Carvajal'),('29003','29','Atlangatepec'),('29004','29','Atltzayanca'),('29005','29','Apizaco'),('29006','29','Calpulalpan'),('29007','29','El Carmen Tequexquitla'),
  ('29008','29','Cuapiaxtla'),('29009','29','Cuaxomulco'),('29010','29','Chiautempan'),('29011','29','Muñoz de Domingo Arenas'),('29012','29','Españita'),('29013','29','Huamantla'),
  ('29014','29','Hueyotlipan'),('29015','29','Ixtacuixtla de Mariano Matamoros'),('29016','29','Ixtenco'),('29017','29','Mazatecochco de José María Morelos'),('29018','29','Contla de Juan Cuamatzi'),('29019','29','Tepetitla de Lardizábal'),
  ('29020','29','Sanctórum de Lázaro Cárdenas'),('29021','29','Nanacamilpa de Mariano Arista'),('29022','29','Acuamanala de Miguel Hidalgo'),('29023','29','Natívitas'),('29024','29','Panotla'),('29025','29','San Pablo del Monte'),
  ('29026','29','Santa Cruz Tlaxcala'),('29027','29','Tenancingo'),('29028','29','Teolocholco'),('29029','29','Tepeyanco'),('29030','29','Terrenate'),('29031','29','Tetla de la Solidaridad'),
  ('29032','29','Tetlatlahuca'),('29033','29','Tlaxcala'),('29034','29','Tlaxco'),('29035','29','Tocatlán'),('29036','29','Totolac'),('29037','29','Ziltlaltépec de Trinidad Sánchez Santos'),
  ('29038','29','Tzompantepec'),('29039','29','Xaloztoc'),('29040','29','Xaltocan'),('29041','29','Papalotla de Xicohténcatl'),('29042','29','Xicohtzinco'),('29043','29','Yauhquemehcan'),
  ('29044','29','Zacatelco'),('29045','29','Benito Juárez'),('29046','29','Emiliano Zapata'),('29047','29','Lázaro Cárdenas'),('29048','29','La Magdalena Tlaltelulco'),('29049','29','San Damián Texóloc'),
  ('29050','29','San Francisco Tetlanohcan'),('29051','29','San Jerónimo Zacualpan'),('29052','29','San José Teacalco'),('29053','29','San Juan Huactzinco'),('29054','29','San Lorenzo Axocomanitla'),('29055','29','San Lucas Tecopilco'),
  ('29056','29','Santa Ana Nopalucan'),('29057','29','Santa Apolonia Teacalco'),('29058','29','Santa Catarina Ayometla'),('29059','29','Santa Cruz Quilehtla'),('29060','29','Santa Isabel Xiloxoxtla'),('30001','30','Acajete'),
  ('30002','30','Acatlán'),('30003','30','Acayucan'),('30004','30','Actopan'),('30005','30','Acula'),('30006','30','Acultzingo'),('30007','30','Camarón de Tejeda'),
  ('30008','30','Alpatláhuac'),('30009','30','Alto Lucero de Gutiérrez Barrios'),('30010','30','Altotonga'),('30011','30','Alvarado'),('30012','30','Amatitlán'),('30013','30','Naranjos Amatlán'),
  ('30014','30','Amatlán de los Reyes'),('30015','30','Angel R. Cabada'),('30016','30','La Antigua'),('30017','30','Apazapan'),('30018','30','Aquila'),('30019','30','Astacinga'),
  ('30020','30','Atlahuilco'),('30021','30','Atoyac'),('30022','30','Atzacan'),('30023','30','Atzalan'),('30024','30','Tlaltetela'),('30025','30','Ayahualulco'),
  ('30026','30','Banderilla'),('30027','30','Benito Juárez'),('30028','30','Boca del Río'),('30029','30','Calcahualco'),('30030','30','Camerino Z. Mendoza'),('30031','30','Carrillo Puerto'),
  ('30032','30','Catemaco'),('30033','30','Cazones de Herrera'),('30034','30','Cerro Azul'),('30035','30','Citlaltépetl'),('30036','30','Coacoatzintla'),('30037','30','Coahuitlán'),
  ('30038','30','Coatepec'),('30039','30','Coatzacoalcos'),('30040','30','Coatzintla'),('30041','30','Coetzala'),('30042','30','Colipa'),('30043','30','Comapa'),
  ('30044','30','Córdoba'),('30045','30','Cosamaloapan de Carpio'),('30046','30','Cosautlán de Carvajal'),('30047','30','Coscomatepec'),('30048','30','Cosoleacaque'),('30049','30','Cotaxtla'),
  ('30050','30','Coxquihui'),('30051','30','Coyutla'),('30052','30','Cuichapa'),('30053','30','Cuitláhuac'),('30054','30','Chacaltianguis'),('30055','30','Chalma'),
  ('30056','30','Chiconamel'),('30057','30','Chiconquiaco'),('30058','30','Chicontepec'),('30059','30','Chinameca'),('30060','30','Chinampa de Gorostiza'),('30061','30','Las Choapas'),
  ('30062','30','Chocamán'),('30063','30','Chontla'),('30064','30','Chumatlán'),('30065','30','Emiliano Zapata'),('30066','30','Espinal'),('30067','30','Filomeno Mata'),
  ('30068','30','Fortín'),('30069','30','Gutiérrez Zamora'),('30070','30','Hidalgotitlán'),('30071','30','Huatusco'),('30072','30','Huayacocotla'),('30073','30','Hueyapan de Ocampo'),
  ('30074','30','Huiloapan de Cuauhtémoc'),('30075','30','Ignacio de la Llave'),('30076','30','Ilamatlán'),('30077','30','Isla'),('30078','30','Ixcatepec'),('30079','30','Ixhuacán de los Reyes'),
  ('30080','30','Ixhuatlán del Café'),('30081','30','Ixhuatlancillo'),('30082','30','Ixhuatlán del Sureste'),('30083','30','Ixhuatlán de Madero'),('30084','30','Ixmatlahuacan'),('30085','30','Ixtaczoquitlán'),
  ('30086','30','Jalacingo'),('30087','30','Xalapa'),('30088','30','Jalcomulco'),('30089','30','Jáltipan'),('30090','30','Jamapa'),('30091','30','Jesús Carranza'),
  ('30092','30','Xico'),('30093','30','Jilotepec'),('30094','30','Juan Rodríguez Clara'),('30095','30','Juchique de Ferrer'),('30096','30','Landero y Coss'),('30097','30','Lerdo de Tejada'),
  ('30098','30','Magdalena'),('30099','30','Maltrata'),('30100','30','Manlio Fabio Altamirano'),('30101','30','Mariano Escobedo'),('30102','30','Martínez de la Torre'),('30103','30','Mecatlán'),
  ('30104','30','Mecayapan'),('30105','30','Medellín de Bravo'),('30106','30','Miahuatlán'),('30107','30','Las Minas'),('30108','30','Minatitlán'),('30109','30','Misantla'),
  ('30110','30','Mixtla de Altamirano'),('30111','30','Moloacán'),('30112','30','Naolinco'),('30113','30','Naranjal'),('30114','30','Nautla'),('30115','30','Nogales'),
  ('30116','30','Oluta'),('30117','30','Omealca'),('30118','30','Orizaba'),('30119','30','Otatitlán'),('30120','30','Oteapan'),('30121','30','Ozuluama de Mascareñas'),
  ('30122','30','Pajapan'),('30123','30','Pánuco'),('30124','30','Papantla'),('30125','30','Paso del Macho'),('30126','30','Paso de Ovejas'),('30127','30','La Perla'),
  ('30128','30','Perote'),('30129','30','Platón Sánchez'),('30130','30','Playa Vicente'),('30131','30','Poza Rica de Hidalgo'),('30132','30','Las Vigas de Ramírez'),('30133','30','Pueblo Viejo'),
  ('30134','30','Puente Nacional'),('30135','30','Rafael Delgado'),('30136','30','Rafael Lucio'),('30137','30','Los Reyes'),('30138','30','Río Blanco'),('30139','30','Saltabarranca'),
  ('30140','30','San Andrés Tenejapan'),('30141','30','San Andrés Tuxtla'),('30142','30','San Juan Evangelista'),('30143','30','Santiago Tuxtla'),('30144','30','Sayula de Alemán'),('30145','30','Soconusco'),
  ('30146','30','Sochiapa'),('30147','30','Soledad Atzompa'),('30148','30','Soledad de Doblado'),('30149','30','Soteapan'),('30150','30','Tamalín'),('30151','30','Tamiahua'),
  ('30152','30','Tampico Alto'),('30153','30','Tancoco'),('30154','30','Tantima'),('30155','30','Tantoyuca'),('30156','30','Tatatila'),('30157','30','Castillo de Teayo'),
  ('30158','30','Tecolutla'),('30159','30','Tehuipango'),('30160','30','Álamo Temapache'),('30161','30','Tempoal'),('30162','30','Tenampa'),('30163','30','Tenochtitlán'),
  ('30164','30','Teocelo'),('30165','30','Tepatlaxco'),('30166','30','Tepetlán'),('30167','30','Tepetzintla'),('30168','30','Tequila'),('30169','30','José Azueta'),
  ('30170','30','Texcatepec'),('30171','30','Texhuacán'),('30172','30','Texistepec'),('30173','30','Tezonapa'),('30174','30','Tierra Blanca'),('30175','30','Tihuatlán'),
  ('30176','30','Tlacojalpan'),('30177','30','Tlacolulan'),('30178','30','Tlacotalpan'),('30179','30','Tlacotepec de Mejía'),('30180','30','Tlachichilco'),('30181','30','Tlalixcoyan'),
  ('30182','30','Tlalnelhuayocan'),('30183','30','Tlapacoyan'),('30184','30','Tlaquilpa'),('30185','30','Tlilapan'),('30186','30','Tomatlán'),('30187','30','Tonayán'),
  ('30188','30','Totutla'),('30189','30','Tuxpan'),('30190','30','Tuxtilla'),('30191','30','Ursulo Galván'),('30192','30','Vega de Alatorre'),('30193','30','Veracruz'),
  ('30194','30','Villa Aldama'),('30195','30','Xoxocotla'),('30196','30','Yanga'),('30197','30','Yecuatla'),('30198','30','Zacualpan'),('30199','30','Zaragoza'),
  ('30200','30','Zentla'),('30201','30','Zongolica'),('30202','30','Zontecomatlán de López y Fuentes'),('30203','30','Zozocolco de Hidalgo'),('30204','30','Agua Dulce'),('30205','30','El Higo'),
  ('30206','30','Nanchital de Lázaro Cárdenas del Río'),('30207','30','Tres Valles'),('30208','30','Carlos A. Carrillo'),('30209','30','Tatahuicapan de Juárez'),('30210','30','Uxpanapa'),('30211','30','San Rafael'),
  ('30212','30','Santiago Sochiapan'),('31001','31','Abalá'),('31002','31','Acanceh'),('31003','31','Akil'),('31004','31','Baca'),('31005','31','Bokobá'),
  ('31006','31','Buctzotz'),('31007','31','Cacalchén'),('31008','31','Calotmul'),('31009','31','Cansahcab'),('31010','31','Cantamayec'),('31011','31','Celestún'),
  ('31012','31','Cenotillo'),('31013','31','Conkal'),('31014','31','Cuncunul'),('31015','31','Cuzamá'),('31016','31','Chacsinkín'),('31017','31','Chankom'),
  ('31018','31','Chapab'),('31019','31','Chemax'),('31020','31','Chicxulub Pueblo'),('31021','31','Chichimilá'),('31022','31','Chikindzonot'),('31023','31','Chocholá'),
  ('31024','31','Chumayel'),('31025','31','Dzan'),('31026','31','Dzemul'),('31027','31','Dzidzantún'),('31028','31','Dzilam de Bravo'),('31029','31','Dzilam González'),
  ('31030','31','Dzitás'),('31031','31','Dzoncauich'),('31032','31','Espita'),('31033','31','Halachó'),('31034','31','Hocabá'),('31035','31','Hoctún'),
  ('31036','31','Homún'),('31037','31','Huhí'),('31038','31','Hunucmá'),('31039','31','Ixil'),('31040','31','Izamal'),('31041','31','Kanasín'),
  ('31042','31','Kantunil'),('31043','31','Kaua'),('31044','31','Kinchil'),('31045','31','Kopomá'),('31046','31','Mama'),('31047','31','Maní'),
  ('31048','31','Maxcanú'),('31049','31','Mayapán'),('31050','31','Mérida'),('31051','31','Mocochá'),('31052','31','Motul'),('31053','31','Muna'),
  ('31054','31','Muxupip'),('31055','31','Opichén'),('31056','31','Oxkutzcab'),('31057','31','Panabá'),('31058','31','Peto'),('31059','31','Progreso'),
  ('31060','31','Quintana Roo'),('31061','31','Río Lagartos'),('31062','31','Sacalum'),('31063','31','Samahil'),('31064','31','Sanahcat'),('31065','31','San Felipe'),
  ('31066','31','Santa Elena'),('31067','31','Seyé'),('31068','31','Sinanché'),('31069','31','Sotuta'),('31070','31','Sucilá'),('31071','31','Sudzal'),
  ('31072','31','Suma'),('31073','31','Tahdziú'),('31074','31','Tahmek'),('31075','31','Teabo'),('31076','31','Tecoh'),('31077','31','Tekal de Venegas'),
  ('31078','31','Tekantó'),('31079','31','Tekax'),('31080','31','Tekit'),('31081','31','Tekom'),('31082','31','Telchac Pueblo'),('31083','31','Telchac Puerto'),
  ('31084','31','Temax'),('31085','31','Temozón'),('31086','31','Tepakán'),('31087','31','Tetiz'),('31088','31','Teya'),('31089','31','Ticul'),
  ('31090','31','Timucuy'),('31091','31','Tinum'),('31092','31','Tixcacalcupul'),('31093','31','Tixkokob'),('31094','31','Tixméhuac'),('31095','31','Tixpéhual'),
  ('31096','31','Tizimín'),('31097','31','Tunkás'),('31098','31','Tzucacab'),('31099','31','Uayma'),('31100','31','Ucú'),('31101','31','Umán'),
  ('31102','31','Valladolid'),('31103','31','Xocchel'),('31104','31','Yaxcabá'),('31105','31','Yaxkukul'),('31106','31','Yobaín'),('32001','32','Apozol'),
  ('32002','32','Apulco'),('32003','32','Atolinga'),('32004','32','Benito Juárez'),('32005','32','Calera'),('32006','32','Cañitas de Felipe Pescador'),('32007','32','Concepción del Oro'),
  ('32008','32','Cuauhtémoc'),('32009','32','Chalchihuites'),('32010','32','Fresnillo'),('32011','32','Trinidad García de la Cadena'),('32012','32','Genaro Codina'),('32013','32','General Enrique Estrada'),
  ('32014','32','General Francisco R. Murguía'),('32015','32','El Plateado de Joaquín Amaro'),('32016','32','General Pánfilo Natera'),('32017','32','Guadalupe'),('32018','32','Huanusco'),('32019','32','Jalpa'),
  ('32020','32','Jerez'),('32021','32','Jiménez del Teul'),('32022','32','Juan Aldama'),('32023','32','Juchipila'),('32024','32','Loreto'),('32025','32','Luis Moya'),
  ('32026','32','Mazapil'),('32027','32','Melchor Ocampo'),('32028','32','Mezquital del Oro'),('32029','32','Miguel Auza'),('32030','32','Momax'),('32031','32','Monte Escobedo'),
  ('32032','32','Morelos'),('32033','32','Moyahua de Estrada'),('32034','32','Nochistlán de Mejía'),('32035','32','Noria de Ángeles'),('32036','32','Ojocaliente'),('32037','32','Pánuco'),
  ('32038','32','Pinos'),('32039','32','Río Grande'),('32040','32','Sain Alto'),('32041','32','El Salvador'),('32042','32','Sombrerete'),('32043','32','Susticacán'),
  ('32044','32','Tabasco'),('32045','32','Tepechitlán'),('32046','32','Tepetongo'),('32047','32','Teúl de González Ortega'),('32048','32','Tlaltenango de Sánchez Román'),('32049','32','Valparaíso'),
  ('32050','32','Vetagrande'),('32051','32','Villa de Cos'),('32052','32','Villa García'),('32053','32','Villa González Ortega'),('32054','32','Villa Hidalgo'),('32055','32','Villanueva'),
  ('32056','32','Zacatecas'),('32057','32','Trancoso'),('32058','32','Santa María de la Paz')
on conflict (cvegeo) do update set cve_ent = excluded.cve_ent, nombre = excluded.nombre;
-- <<< catálogo INEGI

-- "Edo. Méx.", "CDMX", "DF", "Michoacan": cómo escribe la gente cada estado. Si el
-- "estado" es de otro país (Texas, Guatemala), se dice cuál: es exportación.
create table if not exists public.geo_alias_estado (
  alias_norm text primary key,
  cve_ent text references public.geo_estados(cve_ent),
  pais text,
  check ((cve_ent is null) <> (pais is null))
);

insert into public.geo_alias_estado (alias_norm, cve_ent, pais) values
  ('estado de mexico', '15', null), ('edo de mexico', '15', null), ('edo mex', '15', null), ('edomex', '15', null),
  ('edo mexico', '15', null), ('ed de mexico', '15', null), ('edmex', '15', null), ('estado mexico', '15', null),
  ('mex', '15', null), ('edo de mex', '15', null),
  ('cdmx', '09', null), ('cdmex', '09', null), ('df', '09', null), ('d f', '09', null), ('distrito federal', '09', null),
  ('cd de mexico', '09', null), ('cd mexico', '09', null), ('ciudad mexico', '09', null), ('mexico df', '09', null),
  ('mexico d f', '09', null), ('ciudad de mexico cdmx', '09', null),
  ('michoacan', '16', null), ('coahuila', '05', null), ('veracruz', '30', null), ('queretaro de arteaga', '22', null),
  ('qro', '22', null), ('nl', '19', null), ('n l', '19', null), ('slp', '24', null), ('s l p', '24', null),
  ('bc', '02', null), ('b c', '02', null), ('bcs', '03', null), ('b c s', '03', null), ('gto', '11', null),
  ('jal', '14', null), ('mich', '16', null), ('ags', '01', null), ('q roo', '23', null), ('qroo', '23', null),
  ('chih', '08', null), ('tamps', '28', null), ('zac', '32', null), ('hgo', '13', null), ('pue', '21', null),
  ('oax', '20', null), ('gro', '12', null), ('sin', '25', null), ('son', '26', null), ('yuc', '31', null),
  ('texas', null, 'Estados Unidos'), ('california', null, 'Estados Unidos'), ('arizona', null, 'Estados Unidos'),
  ('nuevo mexico', null, 'Estados Unidos'), ('florida', null, 'Estados Unidos'), ('illinois', null, 'Estados Unidos'),
  ('colorado', null, 'Estados Unidos'), ('oklahoma', null, 'Estados Unidos'), ('georgia', null, 'Estados Unidos'),
  ('guatemala', null, 'Guatemala'), ('escuintla', null, 'Guatemala'), ('quetzaltenango', null, 'Guatemala'),
  ('peten', null, 'Guatemala'), ('san salvador', null, 'El Salvador'), ('el salvador', null, 'El Salvador'),
  ('honduras', null, 'Honduras'), ('tegucigalpa', null, 'Honduras'), ('cortes', null, 'Honduras'),
  ('belice', null, 'Belice'), ('nicaragua', null, 'Nicaragua'), ('costa rica', null, 'Costa Rica')
on conflict (alias_norm) do nothing;

-- Lo que dirección corrige a mano. estado_norm = '' vale en cualquier estado ("cd obregon").
-- Sin municipio (cve_ent solo) = "se sabe el estado y ya" ("Ciudad de México" sin alcaldía).
create table if not exists public.geo_alias_ciudad (
  id bigserial primary key,
  estado_norm text not null default '',
  ciudad_norm text not null default '',
  cvegeo text references public.geo_municipios(cvegeo),
  cve_ent text references public.geo_estados(cve_ent),
  no_ubicable boolean not null default false,  -- "Varios", "OTRO": que deje de salir en la cola
  estado_texto text,
  ciudad_texto text,
  origen text not null default 'sistema' check (origen in ('sistema', 'direccion')),
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now(),
  unique (estado_norm, ciudad_norm),
  check (ciudad_norm <> '' or estado_norm <> ''),
  check (cvegeo is not null or cve_ent is not null or no_ubicable)
);

-- País: "Mexico", "Méxicoo", "mÉXICO" o un código postal tecleado en el país son México.
create or replace function public.geo_pais(p_pais text, p_estado text) returns text
language sql stable set search_path = public as $$
  select coalesce(
    (select a.pais from geo_alias_estado a where a.alias_norm = geo_normalizar(p_estado) and a.pais is not null),
    case
      when n is null or n ~ '^(mexic|mejic|mex$|mx$|mexico)' or n ~ '^[0-9 ]+$' then 'México'
      when n in ('usa', 'us', 'eua', 'eeuu', 'ee uu', 'e u a', 'estados unidos', 'estados unidos de america', 'united states') then 'Estados Unidos'
      when n ~ 'salvador' then 'El Salvador'
      else initcap(btrim(p_pais))
    end)
  from (select geo_normalizar(p_pais) n) x
$$;

create or replace function public.geo_estado_de(p_texto text) returns text
language sql stable set search_path = public, extensions as $$
  with n as (select geo_normalizar(p_texto) t)
  select coalesce(
    (select e.cve_ent from geo_estados e, n where n.t in (e.nombre_norm, e.corto_norm, geo_normalizar(e.abreviatura)) limit 1),
    (select a.cve_ent from geo_alias_estado a, n where a.alias_norm = n.t),
    -- "Nueo León", "OAXXACA", "Queretero": el más parecido si gana con claridad.
    (select x.cve_ent from (
       select e.cve_ent, greatest(similarity(e.nombre_norm, n.t), similarity(e.corto_norm, n.t)) s,
              lead(greatest(similarity(e.nombre_norm, n.t), similarity(e.corto_norm, n.t)))
                over (order by greatest(similarity(e.nombre_norm, n.t), similarity(e.corto_norm, n.t)) desc) s2
       from geo_estados e, n where length(n.t) >= 5) x
     where x.s >= 0.45 and x.s - coalesce(x.s2, 0) >= 0.1
     order by x.s desc limit 1))
  from n
$$;

-- Variantes de una ciudad para buscarla: tal cual, cada parte separada por coma
-- ("Sta. Ana Pacueco, Penjamo") y sin prefijos ("CD.", "Mpio. de", "Alcaldía", "Heroica").
create or replace function public.geo_candidatos(p_texto text) returns text[]
language sql immutable parallel safe set search_path = public as $$
  with partes as (
    select geo_normalizar(p_texto) t, 0::bigint o
    union all
    select geo_normalizar(u.x), u.o from unnest(string_to_array(p_texto, ',')) with ordinality u(x, o)
    where p_texto like '%,%'
  ), todas as (
    select t, o, 0 v from partes
    union all
    select regexp_replace(t, '^(cd|ciudad|cuidad|mpio de|mpio|municipio de|municipio|del|delegacion|alcaldia|heroica|h|fracc|fraccionamiento|col|colonia|villa de|villa|ejido|rancho|loc|localidad|poblado) ', ''), o, 1
    from partes
  )
  select coalesce(array_agg(t order by o, v), '{}') from (
    select distinct on (t) t, o, v from todas where t is not null and t <> '' order by t, o, v) x
$$;

-- Apellidos de próceres que cierran muchos nombres de municipio ("… de Morelos",
-- "… de Juárez"): una ciudad que dice solo eso no se liga por terminación.
create or replace function public.geo_es_apellido(t text) returns boolean
language sql immutable parallel safe as $$
  select t = any (array['morelos', 'hidalgo', 'juarez', 'zaragoza', 'guerrero', 'allende', 'obregon', 'madero', 'carranza',
    'victoria', 'bravo', 'abasolo', 'aldama', 'galeana', 'matamoros', 'mina', 'ocampo', 'escobedo', 'arteaga', 'cardenas',
    'zapata', 'alvarez', 'lerdo', 'dominguez', 'gonzalez', 'arista', 'rayon', 'iturbide', 'comonfort', 'degollado', 'lopez',
    'perez', 'garcia', 'ramos', 'reyes', 'santiago', 'teran', 'camargo', 'moreno', 'mendoza', 'rosales', 'leon', 'cosio',
    'de los reyes', 'del rio', 'el alto', 'el grande', 'el chico', 'de la paz', 'de las flores'])
$$;

-- Ubica un estado/ciudad/país escritos a mano. metodo dice cómo se llegó, para que
-- la pantalla de revisión pida confirmar lo dudoso:
--   alias        lo corrigió dirección (o es un alias de fábrica: "Cd. Obregón")
--   exacto       el nombre del municipio tal cual, dentro de su estado
--   aproximado   nombre corto o largo de un solo municipio ("Tepatitlan", "Culiacan de Rosales")
--   parecido     error de dedo ("Guadajara"): se liga, pero se pide confirmar
--   otro_estado  la ciudad existe, pero en otro estado (CDMX/Edo. Méx. se confunden): confirmar
--   ciudad       no se reconoció el estado, pero la ciudad es única en el país
--   estado       solo se sabe el estado
--   extranjero   exportación
--   no_ubicable  dirección dijo que no se puede ("Varios")
--   null         nada: va a la cola
create or replace function public.ubicar(p_estado text, p_ciudad text, p_pais text default 'México')
returns table (cve_ent text, cvegeo text, metodo text)
language plpgsql stable set search_path = public, extensions as $$
declare
  v_en text := coalesce(geo_normalizar(p_estado), '');
  v_cn text := geo_normalizar(p_ciudad);
  v_e text; v_m text; v_lista text[]; c text; r record; v_cands text[]; v_s1 real; v_s2 real; v_lev int;
  v_es_estado boolean;
begin
  if geo_pais(p_pais, p_estado) <> 'México' then
    return query select null::text, null::text, 'extranjero'::text; return;
  end if;

  -- 1. Lo que ya se resolvió a mano manda (el alias del estado escrito gana al de "cualquier estado").
  select a.cvegeo, a.cve_ent, a.no_ubicable into r
  from geo_alias_ciudad a
  where a.ciudad_norm = coalesce(v_cn, '') and a.estado_norm in (v_en, '')
  order by (a.estado_norm = v_en) desc, (a.origen = 'direccion') desc
  limit 1;
  if found then
    if r.no_ubicable then return query select null::text, null::text, 'no_ubicable'::text; return; end if;
    return query select coalesce(left(r.cvegeo, 2), r.cve_ent), r.cvegeo, (case when r.cvegeo is null then 'estado' else 'alias' end)::text;
    return;
  end if;

  v_e := geo_estado_de(p_estado);

  -- 2. Sin ciudad: a veces lo que dice "estado" es una ciudad ("SAN JULIAN", "Fresnillo").
  if v_cn is null then
    if v_e is null and v_en <> '' then
      foreach c in array geo_candidatos(p_estado) loop
        select array_agg(m.cvegeo) into v_lista from geo_municipios m where m.nombre_norm = c;
        if cardinality(v_lista) = 1 then
          return query select left(v_lista[1], 2), v_lista[1], 'ciudad'::text; return;
        end if;
      end loop;
    end if;
    return query select v_e, null::text, (case when v_e is null then null else 'estado' end)::text; return;
  end if;

  v_cands := geo_candidatos(p_ciudad);
  if v_e is not null then
    -- 3. El nombre tal cual, dentro de su estado.
    foreach c in array v_cands loop
      select m.cvegeo into v_m from geo_municipios m where m.cve_ent = v_e and m.nombre_norm = c;
      if v_m is not null then return query select v_e, v_m, 'exacto'::text; return; end if;
    end loop;
    -- 4. El nombre corto o el largo de UN solo municipio del estado, de la regla más segura a la
    --    menos: "Tepatitlan" → Tepatitlán de Morelos, "Culiacan de Rosales" → Culiacán,
    --    "Tlaquepaque" → San Pedro Tlaquepaque, "Santiago Queretaro" → Querétaro. Si una regla
    --    da dos municipios, no se sigue con las más débiles: es ambiguo y va a la cola.
    --    Una "ciudad" que es nombre de estado ("Jalisco") solo vale como cabeza ("Oaxaca" →
    --    Oaxaca de Juárez), nunca como cola ("Ojuelos de Jalisco").
    foreach c in array v_cands loop
      continue when length(c) < 4;
      v_es_estado := exists (select 1 from geo_estados e where c in (e.nombre_norm, e.corto_norm));
      for k in 1..5 loop
        select array_agg(m.cvegeo) into v_lista from geo_municipios m
        where m.cve_ent = v_e and case k
          when 1 then length(c) >= 5 and m.nombre_norm like c || ' %'
          when 2 then not v_es_estado and length(m.nombre_norm) >= 4 and c like m.nombre_norm || ' %'
          when 3 then not v_es_estado and length(c) >= 5 and not geo_es_apellido(c) and m.nombre_norm like '% ' || c
          when 4 then not v_es_estado and length(m.nombre_norm) >= 5 and not geo_es_apellido(m.nombre_norm) and c like '% ' || m.nombre_norm
          else not v_es_estado and length(c) >= 6 and m.nombre_norm like c || '%'
        end;
        if cardinality(v_lista) = 1 then return query select v_e, v_lista[1], 'aproximado'::text; return; end if;
        exit when cardinality(v_lista) > 1;
      end loop;
    end loop;
    -- 5. Error de dedo ("Guadajara", "Queretero", "Gusave"): el más parecido del estado si está a
    --    una o dos letras de distancia, o si se parece mucho ("Melchor de Ocampo"), y gana con
    --    claridad. "Santa María del Valle" NO es "Santa María del Oro": se parecen, pero no por dedo.
    foreach c in array v_cands loop
      continue when length(c) < 5;
      select x.cvegeo, x.s, x.s2, x.lev into v_m, v_s1, v_s2, v_lev from (
        select m.cvegeo, similarity(m.nombre_norm, c) s,
               lead(similarity(m.nombre_norm, c)) over (order by similarity(m.nombre_norm, c) desc) s2,
               levenshtein(m.nombre_norm, c) lev
        from geo_municipios m where m.cve_ent = v_e) x
      order by x.s desc limit 1;
      if (v_s1 >= 0.8 or (v_lev <= 2 and v_s1 >= 0.35)) and v_s1 - coalesce(v_s2, 0) >= 0.1 then
        return query select v_e, v_m, 'parecido'::text; return;
      end if;
    end loop;
  end if;

  -- 6. La ciudad existe tal cual, pero en otro estado (o el estado no se entendió).
  foreach c in array v_cands loop
    select array_agg(m.cvegeo) into v_lista from geo_municipios m where m.nombre_norm = c;
    if cardinality(v_lista) = 1 then
      return query select left(v_lista[1], 2), v_lista[1], (case when v_e is null then 'ciudad' else 'otro_estado' end)::text;
      return;
    end if;
  end loop;

  return query select v_e, null::text, (case when v_e is null then null else 'estado' end)::text;
end $$;

-- Alias de fábrica: nombres de ciudad que no son el del municipio. Se ligan por nombre
-- oficial (no por clave) para que se lean y no dependan de un número tecleado.
insert into public.geo_alias_ciudad (estado_norm, ciudad_norm, cvegeo, cve_ent, origen)
select x.e, x.c, m.cvegeo, null, 'sistema'
from (values
  ('sonora', 'cd obregon', '26', 'cajeme'), ('sonora', 'ciudad obregon', '26', 'cajeme'), ('sonora', 'obregon', '26', 'cajeme'),
  ('sinaloa', 'los mochis', '25', 'ahome'), ('sinaloa', 'mochis', '25', 'ahome'), ('sinaloa', 'guamuchil', '25', 'salvador alvarado'),
  ('jalisco', 'cd guzman', '14', 'zapotlan el grande'), ('jalisco', 'ciudad guzman', '14', 'zapotlan el grande'),
  ('jalisco', 'guzman', '14', 'zapotlan el grande'),
  ('tabasco', 'villahermosa', '27', 'centro'), ('quintana roo', 'cancun', '23', 'benito juarez'),
  ('san luis potosi', 's l p', '24', 'san luis potosi'), ('san luis potosi', 'slp', '24', 'san luis potosi'),
  ('nuevo leon', 'escobedo', '19', 'general escobedo'), ('baja california sur', 'cabo san lucas', '03', 'los cabos'),
  ('baja california sur', 'san jose del cabo', '03', 'los cabos'), ('veracruz', 'poza rica', '30', 'poza rica de hidalgo'),
  ('guerrero', 'zihuatanejo', '12', 'zihuatanejo de azueta'), ('chiapas', 'san cristobal', '07', 'san cristobal de las casas')
) x(e, c, ent, municipio)
join public.geo_municipios m on m.cve_ent = x.ent and m.nombre_norm = x.municipio
on conflict (estado_norm, ciudad_norm) do nothing;

-- "Ciudad de México" como ciudad: el estado es CDMX, la alcaldía no se sabe.
insert into public.geo_alias_ciudad (estado_norm, ciudad_norm, cvegeo, cve_ent, origen)
select '', x.c, null, '09', 'sistema'
from unnest(array['ciudad de mexico', 'cd de mexico', 'cd mexico', 'cdmx', 'cdmex', 'df', 'd f', 'mexico df', 'mexico d f',
                  'distrito federal', 'ciudad mexico', 'mexico city']) x(c)
on conflict (estado_norm, ciudad_norm) do nothing;

-- -----------------------------------------------------------------------------
-- Las columnas en clientes y quién las llena
-- -----------------------------------------------------------------------------
alter table public.clientes
  add column if not exists cve_ent text references public.geo_estados(cve_ent),
  add column if not exists cvegeo text references public.geo_municipios(cvegeo),
  add column if not exists ubicacion text;
comment on column public.clientes.cve_ent is 'Estado INEGI, calculado de estado/ciudad/país por ubicar() (no se captura).';
comment on column public.clientes.cvegeo is 'Municipio INEGI (CVEGEO), calculado por ubicar(); null si no se reconoció la ciudad.';
comment on column public.clientes.ubicacion is 'Cómo se ubicó: alias, exacto, aproximado, parecido, otro_estado, ciudad, estado, extranjero, no_ubicable; null = por revisar.';
create index if not exists clientes_cve_ent on public.clientes (cve_ent);
create index if not exists clientes_cvegeo on public.clientes (cvegeo);

-- Se calcula siempre desde el texto: si alguien escribe cve_ent a mano por la API, se
-- vuelve a calcular. security definer porque lee los alias (que un vendedor no ve)
-- cuando el vendedor da de alta un cliente.
create or replace function public.trg_ubicar_cliente() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('hegamex.reubicando', true) = '1' then return new; end if;
  select u.cve_ent, u.cvegeo, u.metodo into new.cve_ent, new.cvegeo, new.ubicacion
  from ubicar(new.estado, new.ciudad, new.pais) u;
  return new;
end $$;
drop trigger if exists ubicar on public.clientes;
create trigger ubicar before insert or update of estado, ciudad, pais, cve_ent, cvegeo, ubicacion on public.clientes
  for each row execute function public.trg_ubicar_cliente();

-- Vuelve a ubicar a los clientes que coinciden con un estado/ciudad escritos (o a todos).
-- Calcula una vez por combinación, no por cliente: 440 combinaciones para 2,000 clientes.
create or replace function public.reubicar_clientes(p_estado_norm text default null, p_ciudad_norm text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  perform set_config('hegamex.reubicando', '1', true);
  with obj as (
    select c.id, c.estado, c.ciudad, c.pais from clientes c
    where (p_ciudad_norm is null or coalesce(geo_normalizar(c.ciudad), '') = p_ciudad_norm)
      and (coalesce(p_estado_norm, '') = '' or coalesce(geo_normalizar(c.estado), '') = p_estado_norm)
  ), combos as (
    select distinct o.estado, o.ciudad, o.pais from obj o
  ), u as (
    select k.estado, k.ciudad, k.pais, x.cve_ent, x.cvegeo, x.metodo
    from combos k cross join lateral ubicar(k.estado, k.ciudad, k.pais) x
  )
  update clientes c set cve_ent = u.cve_ent, cvegeo = u.cvegeo, ubicacion = u.metodo
  from obj o join u on u.estado is not distinct from o.estado and u.ciudad is not distinct from o.ciudad
                   and u.pais is not distinct from o.pais
  where c.id = o.id
    and (c.cve_ent, c.cvegeo, c.ubicacion) is distinct from (u.cve_ent, u.cvegeo, u.metodo);
  get diagnostics v_n = row_count;
  perform set_config('hegamex.reubicando', '0', true);
  return v_n;
end $$;
revoke execute on function public.reubicar_clientes(text, text) from public, anon, authenticated;

-- Primera ubicación de todos. Sin bitácora ni "actualizado_en": es un dato calculado,
-- no un cambio de nadie, y 2,000 renglones de bitácora tapaban lo que sí importa.
do $$
begin
  alter table public.clientes disable trigger auditar;
  alter table public.clientes disable trigger tocar;
  perform public.reubicar_clientes();
  alter table public.clientes enable trigger auditar;
  alter table public.clientes enable trigger tocar;
end $$;

-- Dirección corrige una combinación estado/ciudad y se aplica a todos los que la escribieron igual.
-- security definer: el dato es derivado y debe quedar igual para TODOS los clientes que coinciden,
-- también los de cuentas que quien corrige no podría editar. Revisa el permiso al entrar.
create or replace function public.corregir_ubicacion(p_estado text, p_ciudad text, p_cvegeo text default null,
  p_cve_ent text default null, p_no_ubicable boolean default false)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_en text := coalesce(geo_normalizar(p_estado), '');
  v_cn text := coalesce(geo_normalizar(p_ciudad), '');
begin
  perform exigir_analisis(3);
  if v_cn = '' and (v_en = '' or geo_estado_de(p_estado) is not null) then
    raise exception 'Sin ciudad no hay a qué municipio ligarlo: captura la ciudad en la ficha del cliente.' using errcode = '22023';
  end if;
  if p_cvegeo is null and p_cve_ent is null and not coalesce(p_no_ubicable, false) then
    raise exception 'Elige el municipio (o el estado).' using errcode = '22023';
  end if;
  if p_cvegeo is not null and not exists (select 1 from geo_municipios where cvegeo = p_cvegeo) then
    raise exception 'El municipio % no está en el catálogo del INEGI.', p_cvegeo using errcode = '22023';
  end if;
  insert into geo_alias_ciudad (estado_norm, ciudad_norm, cvegeo, cve_ent, no_ubicable, estado_texto, ciudad_texto, origen, creado_por, creado_en)
  values (v_en, v_cn, p_cvegeo, case when p_cvegeo is null then p_cve_ent end, coalesce(p_no_ubicable, false),
          nullif(btrim(p_estado), ''), nullif(btrim(p_ciudad), ''), 'direccion', auth.uid(), now())
  on conflict (estado_norm, ciudad_norm) do update
    set cvegeo = excluded.cvegeo, cve_ent = excluded.cve_ent, no_ubicable = excluded.no_ubicable,
        estado_texto = excluded.estado_texto, ciudad_texto = excluded.ciudad_texto,
        origen = 'direccion', creado_por = excluded.creado_por, creado_en = now();
  return reubicar_clientes(v_en, v_cn);
end $$;

create or replace function public.quitar_alias_ubicacion(p_id bigint) returns int
language plpgsql security definer set search_path = public as $$
declare r geo_alias_ciudad;
begin
  perform exigir_analisis(3);
  delete from geo_alias_ciudad where id = p_id and origen = 'direccion' returning * into r;
  if r.id is null then raise exception 'Ese alias no existe o es de fábrica.' using errcode = 'P0002'; end if;
  return reubicar_clientes(r.estado_norm, r.ciudad_norm);
end $$;

-- Para el selector de "Ubicaciones por revisar": busca por nombre dentro de un estado (o en todo el país).
create or replace function public.buscar_municipio(p_q text, p_cve_ent text default null, p_limite int default 12)
returns table (cvegeo text, cve_ent text, nombre text, estado text)
language sql stable security invoker set search_path = public, extensions as $$
  select m.cvegeo, m.cve_ent, m.nombre, e.nombre_corto
  from geo_municipios m join geo_estados e using (cve_ent)
  where (p_cve_ent is null or m.cve_ent = p_cve_ent)
    and (geo_normalizar(p_q) is null or m.nombre_norm like '%' || geo_normalizar(p_q) || '%'
         or similarity(m.nombre_norm, geo_normalizar(p_q)) >= 0.3)
  order by (m.nombre_norm like geo_normalizar(p_q) || '%') desc nulls last,
           similarity(m.nombre_norm, coalesce(geo_normalizar(p_q), '')) desc, m.nombre
  limit p_limite
$$;

-- =============================================================================
-- 2. Familias de producto: reglas de texto que dirección puede editar
-- =============================================================================
create table if not exists public.familias_venta (
  clave text primary key,
  nombre text not null,
  orden int not null
);
insert into public.familias_venta (clave, nombre, orden) values
  ('dosificadoras', 'Dosificadoras (Zeus)', 1),
  ('bandas', 'Bandas transportadoras', 2),
  ('banda_hule', 'Banda de hule y refacción de banda', 3),
  ('helicoidales', 'Helicoidales, bazucas y gusanos', 4),
  ('tolvas_silos', 'Tolvas y silos', 5),
  ('cribas', 'Cribas y cribadoras', 6),
  ('elevadores', 'Elevadores y cangilones', 7),
  ('colectores', 'Colectores de polvo', 8),
  ('poleas', 'Poleas, catarinas y transmisión', 9),
  ('cosedoras', 'Cosedoras y envasadoras', 10),
  ('servicio', 'Servicio, fletes e instalación', 11),
  ('otros', 'Otros', 12)
on conflict (clave) do update set nombre = excluded.nombre, orden = excluded.orden;

-- El patrón es una expresión regular de Postgres sobre el texto en minúsculas y sin
-- acentos. Gana la de menor prioridad: "BAZUCA 8 x 13 M + Flete" es bazuca, no flete.
create table if not exists public.reglas_familia_venta (
  id serial primary key,
  patron text not null,
  familia text not null references public.familias_venta(clave),
  prioridad int not null default 50,
  activo boolean not null default true,
  nota text,
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now(),
  unique (patron, familia)
);

-- Reglas de fábrica (creado_por nulo). Al cambiar una aquí, la vieja se borra; las que agregó
-- dirección (creado_por con alguien) no se tocan.
create temporary table reglas_fabrica (prioridad int, patron text, familia text, nota text);
insert into reglas_fabrica values
  (10, '\m(reparacion|reparar|repara|rep\.|instalacion|puesta en marcha|mantenimiento|mano de obra|capacitacion|modificacion|modificaion|mod\.|proyecto|levantamiento|levantemiento|cambio de|cambiar|inst\.|soporte tecnico|manejo y entrega|fabricacion de)', 'servicio', 'Trabajo, no producto: va antes que el equipo que se repara.'),
  (20, '\m(zeus|dosificador|tren de .{0,4}tolvas)', 'dosificadoras', null),
  (22, '\m(bazuca|helic|hel\.|hecoidal|gusano|gus\M|sin ?fin|rompesacos)|transp(ortador)?\.? (inox )?[0-9]+ ?x', 'helicoidales', 'Bazuca con tolvilla sigue siendo bazuca; "transportador 6x2" es helicoidal.'),
  (24, '\m(colector|filtros? para colector)', 'colectores', null),
  (26, '\melevador', 'elevadores', null),
  (28, '\m(crib|cibrad|zar ?[0-9]|zar\M|v ?3\M|v ?[0-9]{1,2} t\M|v-3|tamiz|tamic|malla)', 'cribas', null),
  (30, '\m(silo|thor|tolva\M|tolvas|conchas?( de aireacion)?|aireacion)', 'tolvas_silos', 'Las conchas de aireación son del silo.'),
  (40, '\mbandas? (artesa|granelera|plana|horizontal|hztal|p/? ?hijuelos|hijuelos|flexibles?|costalera|aplanadora|doble|dos secc|carg|transp|selecc|inclinada|deslizable|telescopica|portatil|hombrera|pedestal|p/? ?cost|para cost)|\mbandap/|banda (de )?[0-9.]+ ?("|pulg)? ?x ?[0-9.]+|transportador(a)? de banda|banda .*[0-9]+ ?hp', 'bandas', 'El equipo completo: artesa, granelera, flexible, costalera, con medidas o motor.'),
  (45, '\m(g\.? ?t(\M|\.)|grip ?top|grapa|engrap|chevron|pvc|rodillo|vulc|utiliti|utility|b\.? ?g\.? ?t|b\.? ?t(\M|\.)|b\.? ?m\.? ?l|m\.? ?l\.? [0-9]|mts? de banda|metros? de banda|banda (negra|blanca|lisa|de hule|nga|[23] ?c)|[0-9.]+ ?(m|mts|metros)\.? (de )?b)', 'banda_hule', 'Banda por metro, grapas, engrapado, vulcanizado y rodillos.'),
  (50, '\m(cangilon|cangion|cang\.|cangs?\M|torn(illos?|\.)? p/? ?cang)', 'elevadores', 'Cangilones y su tornillería.'),
  (55, '\m(polea|catarina|chumacera|chum\M|chum\.|bandas? [ab] ?-?[0-9]|gates|cadena|motorred|motoreduc|reductor|flecha|balero|cople|motor(es)?\M|moto ?vibrador|motobomba)', 'poleas', 'Transmisión: poleas, catarinas, chumaceras, bandas en V, motores.'),
  (60, '\m(cosedora|cabezal|envasadora|empacadora|cono[s]? de hilo|hilo\M|yaohan|newlong|f ?[0-9]{3}a|n ?600)', 'cosedoras', null),
  (70, '\m(flete|envio|paqueteria|serv\.?\M|servicio|renta|viatico|maniobra|seguro)', 'servicio', null),
  (80, '\m(mercado ?libre|mercado l|ventas? (por )?mercado|venta publico|ventas? al publico|refacciones|reembols|reembolo|membresia|gabinete|variador|cable|patin|valvula|indicador|fluidificador|tornill|torn\.|electric|tablero|plc|montacargas|bascula|celda|mezcladora|revolvedor|molino|enmelazadora|descascaradora|pulidor|lanzador|compresor|generador|camion|camioneta|remolque|depositos? de agua|tanque|rodajas?|gato|compuerta|ventilador|motoventilador|cortadora)', 'otros', 'Otras máquinas (mezcladoras, molinos, compresores) y ventas de Mercado Libre o público sin detalle.'),
  (85, '\m(anticipo|restante|restente|complemento de pago|pago final|mercado pago|deposito en efectivo|no fiscal|fiscal de|varios|varias|componentes|piezas)', 'otros', 'Anticipos, pagos y ventas sin producto: no hay de dónde sacar la familia.');

delete from public.reglas_familia_venta r
where r.creado_por is null and not exists (select 1 from reglas_fabrica f where f.patron = r.patron and f.familia = r.familia);
insert into public.reglas_familia_venta (prioridad, patron, familia, nota)
select prioridad, patron, familia, nota from reglas_fabrica
on conflict (patron, familia) do update set prioridad = excluded.prioridad, nota = excluded.nota;
drop table reglas_fabrica;

-- Equipos y componentes del ERP: la categoría del artículo dice la familia.
create table if not exists public.familia_categoria (
  categoria_id int primary key references public.categorias(id) on delete cascade,
  familia text not null references public.familias_venta(clave)
);
insert into public.familia_categoria (categoria_id, familia)
select c.id, x.familia from public.categorias c
join (values
  ('banda transportadora', 'bandas'), ('bazuca', 'helicoidales'), ('cribadora', 'cribas'), ('dosificadora', 'dosificadoras'),
  ('silo para cemento', 'tolvas_silos'), ('tolva', 'tolvas_silos'), ('elevador', 'elevadores'), ('cangilones', 'elevadores'),
  ('bandas', 'banda_hule'), ('bandas transportadoras', 'banda_hule'), ('bandas transportadoras h', 'banda_hule'),
  ('bandas transportadoras metro', 'banda_hule'), ('grapas', 'banda_hule'), ('engrapadoras', 'banda_hule'), ('rodillos', 'banda_hule'),
  ('cosedoras', 'cosedoras'), ('envasadoras', 'cosedoras'), ('catarinas', 'poleas'), ('poleas', 'poleas'), ('pole', 'poleas'),
  ('chumacera', 'poleas'), ('chumacera inox', 'poleas'), ('cadenas', 'poleas'), ('baleros', 'poleas'), ('motores', 'poleas'),
  ('bujes', 'poleas'), ('colectores de polvos', 'colectores'), ('servicio', 'servicio'), ('mezcladora', 'otros'),
  ('electricos', 'otros'), ('tornilleria', 'otros'), ('tornilleria acero inoxidable', 'otros')
) x(cat, familia) on public.geo_normalizar(c.nombre) = x.cat
on conflict (categoria_id) do nothing;

create or replace function public.familia_venta_de(t text) returns text
language sql stable set search_path = public as $$
  select r.familia from reglas_familia_venta r
  where r.activo and sin_acentos(t) ~ r.patron
  order by r.prioridad, r.id limit 1
$$;

-- La familia de cada venta de la hoja queda guardada: con las reglas aplicadas al vuelo,
-- cada gráfica evaluaba 14 expresiones por cada una de 3,000 ventas.
alter table public.historial_ventas_hoja add column if not exists familia text references public.familias_venta(clave);
create index if not exists hist_ventas_familia on public.historial_ventas_hoja (familia) where tipo = 'Venta';

create or replace function public.trg_familia_historial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.familia := familia_venta_de(new.descripcion);
  return new;
end $$;
drop trigger if exists familia on public.historial_ventas_hoja;
create trigger familia before insert or update of descripcion on public.historial_ventas_hoja
  for each row execute function public.trg_familia_historial();

create or replace function public.reclasificar_ventas() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  update historial_ventas_hoja h set familia = x.f
  from (select id, familia_venta_de(descripcion) f from historial_ventas_hoja where tipo = 'Venta') x
  where h.id = x.id and h.familia is distinct from x.f;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.reclasificar_ventas() from public, anon, authenticated;
select public.reclasificar_ventas();

-- Dirección agrega o cambia una regla y se reclasifica todo de una vez.
create or replace function public.guardar_regla_familia(p_id int, p_patron text, p_familia text,
  p_prioridad int default 50, p_activo boolean default true, p_nota text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id int; v_n int;
begin
  perform exigir_analisis(3);
  if coalesce(btrim(p_patron), '') = '' then raise exception 'Escribe el patrón.' using errcode = '22023'; end if;
  begin
    perform '' ~ p_patron;
  exception when invalid_regular_expression then
    raise exception 'El patrón no es una expresión válida: %', sqlerrm using errcode = '22023';
  end;
  if not exists (select 1 from familias_venta where clave = p_familia) then
    raise exception 'No existe la familia %.', p_familia using errcode = '22023';
  end if;
  if p_id is null then
    insert into reglas_familia_venta (patron, familia, prioridad, activo, nota)
    values (lower(btrim(p_patron)), p_familia, coalesce(p_prioridad, 50), coalesce(p_activo, true), p_nota)
    on conflict (patron, familia) do update set prioridad = excluded.prioridad, activo = excluded.activo, nota = excluded.nota
    returning id into v_id;
  else
    update reglas_familia_venta set patron = lower(btrim(p_patron)), familia = p_familia, prioridad = coalesce(p_prioridad, prioridad),
      activo = coalesce(p_activo, activo), nota = p_nota
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Esa regla ya no existe.' using errcode = 'P0002'; end if;
  end if;
  v_n := reclasificar_ventas();
  return jsonb_build_object('id', v_id, 'reclasificadas', v_n);
end $$;

create or replace function public.borrar_regla_familia(p_id int) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform exigir_analisis(3);
  delete from reglas_familia_venta where id = p_id;
  if not found then raise exception 'Esa regla ya no existe.' using errcode = 'P0002'; end if;
  return jsonb_build_object('reclasificadas', reclasificar_ventas());
end $$;

-- Antes de guardar: a cuántas ventas les pegaría y a cuáles les cambia la familia.
create or replace function public.probar_regla_familia(p_patron text, p_familia text default null)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare r jsonb;
begin
  perform exigir_analisis(1);
  begin
    perform '' ~ p_patron;
  exception when invalid_regular_expression then
    return jsonb_build_object('error', 'El patrón no es una expresión válida: ' || sqlerrm);
  end;
  select jsonb_build_object(
    'coinciden', count(*), 'monto', coalesce(round(sum(monto), 2), 0),
    'sin_clasificar', count(*) filter (where familia is null),
    'cambian', count(*) filter (where p_familia is not null and familia is distinct from p_familia),
    'ejemplos', coalesce((select jsonb_agg(e) from (
        select jsonb_build_object('descripcion', h2.descripcion, 'familia', h2.familia, 'monto', h2.monto) e
        from historial_ventas_hoja h2 where h2.tipo = 'Venta' and sin_acentos(h2.descripcion) ~ p_patron
        order by h2.familia nulls first, h2.monto desc limit 12) z), '[]'))
  into r
  from historial_ventas_hoja h where h.tipo = 'Venta' and sin_acentos(h.descripcion) ~ p_patron;
  return r;
end $$;

-- =============================================================================
-- 3. La base de todo: cada venta con su cliente, su operación y su familia
-- =============================================================================
-- Misma regla que ventas_entre(): libro de la hoja antes del arranque, pedidos del ERP
-- desde el arranque, sin cancelados ni los pedidos históricos que repiten la hoja.
-- El pedido se reparte entre sus partidas en proporción a su importe (el total con IVA
-- y tipo de cambio, igual que ventas_entre), así la suma por familia da el total.
-- SQL simple (sin SET) para que el planeador la pueda meter dentro de cada consulta.
create or replace function public.ventas_detalle(p_desde date, p_hasta date)
returns table (fecha date, cliente_id uuid, monto numeric, operacion text, familia text, descripcion text, origen text)
language sql stable security invoker as $$
  with arranque as (select coalesce((select (valor #>> '{}')::date from public.configuracion where clave = 'fecha_arranque'), current_date) f),
  permiso as (select public.puede('analisis', 1) ok)
  select h.fecha, h.cliente_id, h.monto, 'h' || coalesce(nullif(h.factura, ''), nullif(h.pedido, ''), h.id::text),
         h.familia, h.descripcion, 'hoja'::text
  from public.historial_ventas_hoja h, arranque a, permiso
  where permiso.ok and h.tipo = 'Venta' and h.fecha between p_desde and p_hasta and h.fecha < a.f
  union all
  select p.fecha, p.cliente_id,
         p.total * p.tipo_cambio * coalesce(l.importe / nullif(s.suma, 0), 1.0 / greatest(s.n, 1)),
         'p' || p.id::text,
         coalesce(fc.familia, public.familia_venta_de(coalesce(l.titulo, '') || ' ' || coalesce(l.descripcion, ''))),
         coalesce(l.titulo, l.descripcion), 'erp'::text
  from public.pedidos p cross join arranque a cross join permiso
  left join lateral (select sum(x.importe) suma, count(*) n from public.pedido_lineas x where x.pedido_id = p.id) s on true
  left join public.pedido_lineas l on l.pedido_id = p.id
  left join public.articulos ar on ar.id = l.articulo_id
  left join public.familia_categoria fc on fc.categoria_id = ar.categoria_id
  where permiso.ok and p.estado <> 'cancelado' and not p.historico and p.fecha between p_desde and p_hasta and p.fecha >= a.f
$$;

-- Contra qué se compara: hasta un año, el mismo tramo un año antes ("este año" contra
-- "el año pasado a la misma fecha"); más largo, el tramo de igual duración inmediato anterior.
create or replace function public.periodo_anterior(p_desde date, p_hasta date, out desde date, out hasta date)
language sql immutable as $$
  select case when p_hasta - p_desde <= 366 then (p_desde - interval '1 year')::date else p_desde - (p_hasta - p_desde + 1) end,
         case when p_hasta - p_desde <= 366 then (p_hasta - interval '1 year')::date else p_desde - 1 end
$$;

-- =============================================================================
-- 4. Mapa de ventas: país → estado → municipio
-- =============================================================================
create or replace function public.analisis_mapa(p_desde date, p_hasta date, p_cve_ent text default null)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  a record;
  r jsonb;
begin
  perform exigir_analisis(1);
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'El periodo no es válido.' using errcode = '22023';
  end if;
  select * into a from periodo_anterior(p_desde, p_hasta);

  with v as (
    select 'act' per, d.cliente_id, d.monto, d.operacion from ventas_detalle(p_desde, p_hasta) d
    union all
    select 'ant', d.cliente_id, d.monto, d.operacion from ventas_detalle(a.desde, a.hasta) d
  ), k as (
    select v.per, v.cliente_id, v.monto, v.operacion,
      case
        when p_cve_ent is null then
          case when c.ubicacion = 'extranjero' then 'ext:' || geo_pais(c.pais, c.estado)
               when c.cve_ent is null then 'sin_ubicar' else c.cve_ent end
        when c.cve_ent is distinct from p_cve_ent then null
        when c.cvegeo is null then 'sin_municipio'
        else c.cvegeo
      end clave
    from v left join clientes c on c.id = v.cliente_id
  ), g as (
    select clave,
      coalesce(sum(monto) filter (where per = 'act'), 0) monto,
      coalesce(sum(monto) filter (where per = 'ant'), 0) monto_ant,
      count(distinct cliente_id) filter (where per = 'act') clientes,
      count(distinct cliente_id) filter (where per = 'ant') clientes_ant,
      count(distinct operacion) filter (where per = 'act') operaciones
    from k where clave is not null group by clave
  ), reg as (
    select g.*, coalesce(e.nombre_corto, m.nombre) nombre,
      row_number() over (order by g.monto desc, g.monto_ant desc) lugar
    from g
    left join geo_estados e on p_cve_ent is null and e.cve_ent = g.clave
    left join geo_municipios m on p_cve_ent is not null and m.cvegeo = g.clave
    where g.clave not in ('sin_ubicar', 'sin_municipio') and g.clave not like 'ext:%'
  ), tot as (
    select sum(monto) total, sum(monto_ant) total_ant from g
  ), totreg as (
    select sum(monto) total, count(*) filter (where monto > 0) con_venta,
           sum(monto) filter (where lugar <= 3) top3 from reg
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', p_desde, 'hasta', p_hasta, 'ant_desde', a.desde, 'ant_hasta', a.hasta),
    'nivel', case when p_cve_ent is null then 'pais' else 'estado' end,
    'cve_ent', p_cve_ent,
    'nombre', (select nombre_corto from geo_estados where cve_ent = p_cve_ent),
    'total', round(coalesce(tot.total, 0), 2),
    'total_anterior', round(coalesce(tot.total_ant, 0), 2),
    'cambio', case when tot.total_ant > 0 then round(tot.total / tot.total_ant - 1, 4) end,
    'clientes', (select count(distinct cliente_id) from k where per = 'act' and clave is not null),
    'operaciones', (select count(distinct operacion) from k where per = 'act' and clave is not null),
    'regiones_con_venta', coalesce(totreg.con_venta, 0),
    'concentracion_top3', case when totreg.total > 0 then round(totreg.top3 / totreg.total, 4) end,
    'regiones', coalesce((select jsonb_agg(jsonb_build_object(
        'cve', reg.clave, 'nombre', reg.nombre, 'monto', round(reg.monto, 2), 'monto_anterior', round(reg.monto_ant, 2),
        'clientes', reg.clientes, 'clientes_anterior', reg.clientes_ant, 'operaciones', reg.operaciones,
        'ticket', case when reg.operaciones > 0 then round(reg.monto / reg.operaciones, 2) end,
        'participacion', case when totreg.total > 0 then round(reg.monto / totreg.total, 4) end,
        'cambio', case when reg.monto_ant > 0 then round(reg.monto / reg.monto_ant - 1, 4) end,
        'nuevo', reg.monto_ant = 0 and reg.monto > 0) order by reg.monto desc, reg.monto_ant desc) from reg), '[]'),
    'sin_ubicar', (select jsonb_build_object('monto', round(g.monto, 2), 'monto_anterior', round(g.monto_ant, 2), 'clientes', g.clientes)
                   from g where g.clave = 'sin_ubicar'),
    'sin_municipio', (select jsonb_build_object('monto', round(g.monto, 2), 'monto_anterior', round(g.monto_ant, 2), 'clientes', g.clientes)
                      from g where g.clave = 'sin_municipio'),
    'extranjero', coalesce((select jsonb_agg(jsonb_build_object('pais', substr(g.clave, 5), 'monto', round(g.monto, 2),
                      'monto_anterior', round(g.monto_ant, 2), 'clientes', g.clientes) order by g.monto desc)
                    from g where g.clave like 'ext:%'), '[]')
  ) into r
  from tot cross join totreg;
  return r;
end $$;

-- Zonas que se enfriaron: compraban y cayeron fuerte (o dejaron de comprar), con el
-- dinero que se fue y los clientes que ya no compraron ahí, para llamarles.
create or replace function public.analisis_zonas_frias(p_desde date, p_hasta date, p_cve_ent text default null,
  p_caida numeric default 0.3, p_limite int default 8)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare a record; r jsonb;
begin
  perform exigir_analisis(1);
  select * into a from periodo_anterior(p_desde, p_hasta);
  with v as (
    select 'act' per, d.cliente_id, d.monto, d.fecha from ventas_detalle(p_desde, p_hasta) d where d.cliente_id is not null
    union all
    select 'ant', d.cliente_id, d.monto, d.fecha from ventas_detalle(a.desde, a.hasta) d where d.cliente_id is not null
  ), k as (
    select v.*, case when p_cve_ent is null then c.cve_ent when c.cve_ent = p_cve_ent then c.cvegeo end clave
    from v join clientes c on c.id = v.cliente_id
  ), cli as (
    select clave, cliente_id,
      coalesce(sum(monto) filter (where per = 'act'), 0) act, coalesce(sum(monto) filter (where per = 'ant'), 0) ant,
      max(fecha) ultima
    from k where clave is not null group by clave, cliente_id
  ), z as (
    select clave, sum(act) act, sum(ant) ant, count(*) filter (where ant > 0 and act = 0) perdidos
    from cli group by clave
    having sum(ant) > 0 and sum(act) <= sum(ant) * (1 - p_caida)
    order by sum(ant) - sum(act) desc limit p_limite
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'cve', z.clave, 'nombre', coalesce(e.nombre_corto, m.nombre), 'cve_ent', coalesce(e.cve_ent, m.cve_ent),
      'monto', round(z.act, 2), 'monto_anterior', round(z.ant, 2), 'perdido', round(z.ant - z.act, 2),
      'cambio', round(z.act / z.ant - 1, 4), 'clientes_perdidos', z.perdidos,
      'clientes', coalesce((select jsonb_agg(jsonb_build_object('id', x.cliente_id, 'nombre', cl.nombre, 'vendedor', pf.nombre,
            'monto_anterior', round(x.ant, 2), 'ultima_compra', x.ultima) order by x.ant desc)
          from (select * from cli where cli.clave = z.clave and cli.ant > 0 and cli.act = 0 order by cli.ant desc limit 6) x
          join clientes cl on cl.id = x.cliente_id left join perfiles pf on pf.id = cl.vendedor_id), '[]')
    ) order by z.ant - z.act desc), '[]')
  into r
  from z left join geo_estados e on p_cve_ent is null and e.cve_ent = z.clave
         left join geo_municipios m on p_cve_ent is not null and m.cvegeo = z.clave;
  return jsonb_build_object('periodo', jsonb_build_object('desde', p_desde, 'hasta', p_hasta, 'ant_desde', a.desde, 'ant_hasta', a.hasta),
                            'caida', p_caida, 'zonas', r);
end $$;

-- =============================================================================
-- 5. Ubicaciones por revisar
-- =============================================================================
create or replace function public.analisis_ubicaciones() returns jsonb
language plpgsql stable security invoker set search_path = public, extensions as $$
declare r jsonb;
begin
  perform exigir_analisis(1);
  with v as (
    select d.cliente_id, sum(d.monto) monto from ventas_detalle('1900-01-01', hoy_planta()) d group by d.cliente_id
  ), c as (
    select cl.id, cl.estado, cl.ciudad, cl.pais, cl.cve_ent, cl.cvegeo, cl.ubicacion, coalesce(v.monto, 0) monto,
           coalesce(geo_normalizar(cl.estado), '') en, coalesce(geo_normalizar(cl.ciudad), '') cn
    from clientes cl left join v on v.cliente_id = cl.id
  ), tot as (
    select coalesce((select sum(monto) from v), 0) total,
           coalesce(sum(monto) filter (where cve_ent is not null), 0) estado,
           coalesce(sum(monto) filter (where cvegeo is not null), 0) municipio,
           coalesce(sum(monto) filter (where ubicacion = 'extranjero'), 0) extranjero,
           count(*) clientes, count(*) filter (where cve_ent is not null) clientes_estado,
           count(*) filter (where cvegeo is not null) clientes_municipio
    from c
  ), grupos as (
    select c.en, c.cn, mode() within group (order by c.estado) estado_texto, mode() within group (order by c.ciudad) ciudad_texto,
      min(c.cve_ent) cve_ent, min(c.cvegeo) cvegeo, min(c.ubicacion) ubicacion,
      count(*) clientes, sum(c.monto) monto
    from c
    where (c.ubicacion is null or c.ubicacion in ('estado', 'parecido', 'otro_estado', 'ciudad', 'aproximado'))
      -- "Ciudad de México" sin alcaldía ya se resolvió a propósito como solo estado: no hay más que hacer.
      and not exists (select 1 from geo_alias_ciudad a where a.ciudad_norm = c.cn and c.cn <> '' and a.estado_norm in (c.en, '')
                      and a.cvegeo is null and not a.no_ubicable)
    group by c.en, c.cn
  )
  select jsonb_build_object(
    'cobertura', (select jsonb_build_object('total', round(total, 2), 'estado', round(estado, 2), 'municipio', round(municipio, 2),
        'extranjero', round(extranjero, 2),
        'pct_estado', case when total > 0 then round(estado / total, 4) end,
        'pct_municipio', case when total > 0 then round(municipio / total, 4) end,
        'clientes', clientes, 'clientes_estado', clientes_estado, 'clientes_municipio', clientes_municipio) from tot),
    'grupos', coalesce((select jsonb_agg(jsonb_build_object(
        'estado_texto', g.estado_texto, 'ciudad_texto', g.ciudad_texto, 'estado_norm', g.en, 'ciudad_norm', g.cn,
        'cve_ent', g.cve_ent, 'estado', e.nombre_corto, 'cvegeo', g.cvegeo, 'municipio', m.nombre,
        'clientes', g.clientes, 'monto', round(g.monto, 2),
        'motivo', case
          when g.ubicacion is null and g.cve_ent is null then 'sin_estado'
          when g.ubicacion = 'estado' and g.cn = '' then 'sin_ciudad'
          when g.ubicacion = 'estado' then 'ciudad_no_reconocida'
          else g.ubicacion end,
        -- Los tres municipios que más se parecen, para elegir con un clic.
        'sugerencias', case when g.cn <> '' or g.cve_ent is null then coalesce((select jsonb_agg(jsonb_build_object('cvegeo', s.cvegeo, 'nombre', s.nombre, 'estado', s.estado))
            from (select mm.cvegeo, mm.nombre, ee.nombre_corto estado
                  from geo_municipios mm join geo_estados ee using (cve_ent)
                  where (g.cve_ent is null or mm.cve_ent = g.cve_ent) and coalesce(nullif(g.cn, ''), g.en) <> ''
                    and similarity(mm.nombre_norm, coalesce(nullif(g.cn, ''), g.en)) >= 0.2
                  order by similarity(mm.nombre_norm, coalesce(nullif(g.cn, ''), g.en)) desc limit 3) s), '[]') else '[]' end
      ) order by g.monto desc, g.clientes desc)
      from grupos g left join geo_estados e on e.cve_ent = g.cve_ent left join geo_municipios m on m.cvegeo = g.cvegeo), '[]'),
    'alias', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'estado_texto', a.estado_texto, 'ciudad_texto', a.ciudad_texto,
        'cvegeo', a.cvegeo, 'municipio', m.nombre, 'cve_ent', coalesce(m.cve_ent, a.cve_ent), 'estado', e.nombre_corto,
        'no_ubicable', a.no_ubicable, 'por', p.nombre, 'en', a.creado_en,
        'clientes', (select count(*) from c where c.cn = a.ciudad_norm and (a.estado_norm = '' or c.en = a.estado_norm))) order by a.creado_en desc)
      from geo_alias_ciudad a left join geo_municipios m on m.cvegeo = a.cvegeo
      left join geo_estados e on e.cve_ent = coalesce(m.cve_ent, a.cve_ent) left join perfiles p on p.id = a.creado_por
      where a.origen = 'direccion'), '[]')
  ) into r;
  return r;
end $$;

-- Los clientes detrás de un renglón de la cola: los que no tienen ni estado ni ciudad no se
-- arreglan con un alias, se arreglan capturando el dato en su ficha.
create or replace function public.analisis_clientes_de_ubicacion(p_estado_norm text, p_ciudad_norm text, p_limite int default 50)
returns table (id uuid, nombre text, vendedor text, estado text, ciudad text, monto numeric, ultima date)
language plpgsql stable security invoker set search_path = public as $$
begin
  perform exigir_analisis(1);
  return query
    with v as (select d.cliente_id, sum(d.monto) monto, max(d.fecha) ultima
               from ventas_detalle('1900-01-01', hoy_planta()) d group by 1)
    select c.id, c.nombre, p.nombre, c.estado, c.ciudad, round(coalesce(v.monto, 0), 2), v.ultima
    from clientes c
    left join perfiles p on p.id = c.vendedor_id
    left join v on v.cliente_id = c.id
    where coalesce(geo_normalizar(c.estado), '') = coalesce(p_estado_norm, '')
      and coalesce(geo_normalizar(c.ciudad), '') = coalesce(p_ciudad_norm, '')
    order by v.monto desc nulls last, c.nombre
    limit p_limite;
end $$;

-- =============================================================================
-- 6. Tendencias
-- =============================================================================
create or replace function public.analisis_tendencias(p_desde date default '2018-01-01')
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare v_hoy date := hoy_planta(); r jsonb;
begin
  perform exigir_analisis(1);
  with d as (select * from ventas_detalle(p_desde, v_hoy)),
  m as (select date_trunc('month', fecha)::date mes, sum(monto) monto, count(distinct operacion) ops,
               count(distinct cliente_id) clientes from d group by 1),
  s as (select gs::date mes from generate_series(date_trunc('month', p_desde), date_trunc('month', v_hoy), interval '1 month') gs),
  x as (select s.mes, coalesce(m.monto, 0) monto, coalesce(m.ops, 0) ops, coalesce(m.clientes, 0) clientes
        from s left join m using (mes)),
  y as (select x.*,
          sum(monto) over w12 movil_12, count(*) over w12 n12,
          sum(monto) over (order by mes rows between 23 preceding and 12 preceding) movil_12_ant,
          count(*) over (order by mes rows between 23 preceding and 12 preceding) n12_ant
        from x window w12 as (order by mes rows between 11 preceding and current row))
  select jsonb_build_object(
    'hoy', v_hoy,
    'mensual', (select jsonb_agg(jsonb_build_object('mes', y.mes, 'monto', round(y.monto, 2), 'operaciones', y.ops, 'clientes', y.clientes,
        'parcial', y.mes = date_trunc('month', v_hoy)::date,
        -- Crecimiento de los 12 meses que terminan en este mes contra los 12 anteriores. El mes
        -- en curso no cuenta: compararía un mes a medias contra uno completo.
        'movil_12', case when y.n12 = 12 then round(y.movil_12, 2) end,
        'crecimiento_12', case when y.n12 = 12 and y.n12_ant = 12 and y.movil_12_ant > 0 and y.mes < date_trunc('month', v_hoy)::date
                               then round(y.movil_12 / y.movil_12_ant - 1, 4) end) order by y.mes) from y),
    'familias', (select jsonb_agg(jsonb_build_object('clave', f.clave, 'nombre', f.nombre, 'orden', f.orden) order by f.orden)
                 from familias_venta f),
    'familias_anio', (select coalesce(jsonb_agg(jsonb_build_object('anio', t.anio, 'familia', t.familia, 'monto', round(t.monto, 2))
                       order by t.anio, t.familia), '[]')
                      from (select extract(year from fecha)::int anio, coalesce(familia, 'sin_clasificar') familia, sum(monto) monto
                            from d group by 1, 2) t)
  ) into r;
  return r;
end $$;

-- =============================================================================
-- 7. Clientes: concentración, nuevos y recurrentes, cohortes y segmentos
-- =============================================================================

-- Segmento de cada cliente a una fecha de corte, con reglas que se pueden decir en voz alta:
--   campeones   compró en los últimos 12 meses, 3+ compras en 3 años y está en el 20 % que más compra
--   nuevos      su primera compra fue en los últimos 12 meses
--   leales      compró en los últimos 12 meses y 2+ veces en 3 años
--   ocasionales compró en los últimos 12 meses, una vez en 3 años
--   en_riesgo   su última compra fue hace 12 a 24 meses y compraba seguido o mucho
--   dormidos    su última compra fue hace 12 a 24 meses
--   perdidos    hace más de 24 meses que no compra
create or replace function public.clientes_segmentados(p_corte date default null)
returns table (cliente_id uuid, nombre text, vendedor text, cve_ent text, estado text, municipio text,
               primera date, ultima date, compras_3a int, monto_3a numeric, monto_total numeric, segmento text)
language sql stable security invoker set search_path = public as $$
  with corte as (select coalesce(p_corte, hoy_planta()) f),
  v as (select d.* from corte, ventas_detalle('1900-01-01', corte.f) d where d.cliente_id is not null),
  c as (
    select v.cliente_id, min(v.fecha) primera, max(v.fecha) ultima,
      count(distinct v.operacion) filter (where v.fecha > corte.f - interval '3 years')::int compras_3a,
      coalesce(sum(v.monto) filter (where v.fecha > corte.f - interval '3 years'), 0) monto_3a,
      sum(v.monto) monto_total
    from v, corte group by v.cliente_id
  ),
  p as (select percentile_cont(0.8) within group (order by c.monto_3a) p80, percentile_cont(0.5) within group (order by c.monto_3a) p50
        from c, corte where c.ultima > corte.f - interval '3 years')
  select c.cliente_id, cl.nombre, pf.nombre, cl.cve_ent, e.nombre_corto, m.nombre, c.primera, c.ultima, c.compras_3a,
    round(c.monto_3a, 2), round(c.monto_total, 2),
    case
      when c.ultima > corte.f - interval '12 months' and c.compras_3a >= 3 and c.monto_3a >= p.p80 then 'campeones'
      when c.ultima > corte.f - interval '12 months' and c.primera > corte.f - interval '12 months' then 'nuevos'
      when c.ultima > corte.f - interval '12 months' and c.compras_3a >= 2 then 'leales'
      when c.ultima > corte.f - interval '12 months' then 'ocasionales'
      when c.ultima > corte.f - interval '24 months' and (c.compras_3a >= 2 or c.monto_3a >= p.p50) then 'en_riesgo'
      when c.ultima > corte.f - interval '24 months' then 'dormidos'
      else 'perdidos'
    end
  from c cross join corte cross join p
  join clientes cl on cl.id = c.cliente_id
  left join perfiles pf on pf.id = cl.vendedor_id
  left join geo_estados e on e.cve_ent = cl.cve_ent
  left join geo_municipios m on m.cvegeo = cl.cvegeo
$$;

create or replace function public.analisis_clientes(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare r jsonb; v_hoy date := hoy_planta();
begin
  perform exigir_analisis(1);
  with per as (
    select d.cliente_id, sum(d.monto) monto, count(distinct d.operacion) ops
    from ventas_detalle(p_desde, p_hasta) d where d.cliente_id is not null group by 1
  ), ord as (
    select per.*, row_number() over (order by monto desc) n, count(*) over () total_n,
           sum(monto) over (order by monto desc rows unbounded preceding) acum, sum(monto) over () total
    from per where monto > 0
  ), hist as (
    select d.cliente_id, extract(year from d.fecha)::int anio, sum(d.monto) monto
    from ventas_detalle('1900-01-01', v_hoy) d where d.cliente_id is not null group by 1, 2
  ), coh as (
    select cliente_id, min(anio) cohorte from hist group by 1
  ), prim as (
    select coh.cliente_id from coh join hist h on h.cliente_id = coh.cliente_id and h.anio = coh.cohorte
  ), seg as (
    select * from clientes_segmentados(p_hasta)
  )
  select jsonb_build_object(
    'resumen', (select jsonb_build_object(
        'clientes', count(*), 'monto', round(coalesce(sum(o.monto), 0), 2),
        'operaciones', coalesce(sum(o.ops), 0),
        'clientes_80', min(o.n) filter (where o.acum >= o.total * 0.8),
        'pct_clientes_80', round(min(o.n) filter (where o.acum >= o.total * 0.8)::numeric / nullif(max(o.total_n), 0), 4),
        'top10_participacion', round(sum(o.monto) filter (where o.n <= 10) / nullif(max(o.total), 0), 4),
        'nuevos', (select count(*) from per join (select cliente_id, min(fecha) primera from ventas_detalle('1900-01-01', p_hasta) group by 1) f
                   using (cliente_id) where f.primera >= p_desde))
      from ord o),
    -- 101 puntos: con 1,500 clientes la curva completa pesaba más que el resto de la pantalla.
    'pareto', coalesce((select jsonb_agg(jsonb_build_object('pct_clientes', k / 100.0,
        'pct_venta', coalesce((select round(max(o.acum) / max(o.total), 4) from ord o where o.n <= ceil(o.total_n * k / 100.0)), 0)) order by k)
      from generate_series(0, 100) k where exists (select 1 from ord)), '[]'),
    'top', coalesce((select jsonb_agg(jsonb_build_object('id', o.cliente_id, 'nombre', cl.nombre, 'monto', round(o.monto, 2),
        'participacion', round(o.monto / o.total, 4), 'acumulado', round(o.acum / o.total, 4)) order by o.n)
      from ord o join clientes cl on cl.id = o.cliente_id where o.n <= 15), '[]'),
    'por_anio', coalesce((select jsonb_agg(jsonb_build_object('anio', t.anio, 'nuevos', t.nuevos, 'recurrentes', t.recurrentes,
        'monto_nuevos', round(t.mn, 2), 'monto_recurrentes', round(t.mr, 2)) order by t.anio)
      from (select h.anio, count(*) filter (where h.anio = coh.cohorte) nuevos, count(*) filter (where h.anio > coh.cohorte) recurrentes,
                   coalesce(sum(h.monto) filter (where h.anio = coh.cohorte), 0) mn, coalesce(sum(h.monto) filter (where h.anio > coh.cohorte), 0) mr
            from hist h join coh using (cliente_id) group by h.anio) t), '[]'),
    -- Cohorte = año de la primera compra; k = años después. Retención = cuántos de esa
    -- cohorte volvieron a comprar en el año cohorte + k.
    'cohortes', coalesce((select jsonb_agg(jsonb_build_object('cohorte', t.cohorte, 'clientes', t.n, 'anios', t.anios) order by t.cohorte)
      from (select coh.cohorte, count(distinct coh.cliente_id) n,
                   (select jsonb_agg(jsonb_build_object('k', z.k, 'clientes', z.c) order by z.k)
                    from (select h.anio - c2.cohorte k, count(*) c from coh c2 join hist h using (cliente_id)
                          where c2.cohorte = coh.cohorte and h.anio > c2.cohorte group by 1) z) anios
            from coh group by coh.cohorte) t), '[]'),
    'segmentos', coalesce((select jsonb_agg(jsonb_build_object('segmento', s.segmento, 'clientes', s.n, 'monto_3a', round(s.m3, 2),
        'monto_total', round(s.mt, 2)) order by array_position(array['campeones', 'nuevos', 'leales', 'ocasionales', 'en_riesgo', 'dormidos', 'perdidos'], s.segmento))
      from (select segmento, count(*) n, sum(monto_3a) m3, sum(monto_total) mt from seg group by 1) s), '[]'),
    'corte', p_hasta
  ) into r;
  return r;
end $$;

create or replace function public.analisis_segmento_clientes(p_segmento text default null, p_corte date default null)
returns table (cliente_id uuid, nombre text, vendedor text, cve_ent text, estado text, municipio text,
               primera date, ultima date, compras_3a int, monto_3a numeric, monto_total numeric, segmento text)
language plpgsql stable security invoker set search_path = public as $$
begin
  perform exigir_analisis(1);
  return query select s.* from clientes_segmentados(p_corte) s
               where p_segmento is null or s.segmento = p_segmento
               order by s.monto_3a desc, s.monto_total desc;
end $$;

-- =============================================================================
-- 8. Producto × región
-- =============================================================================
create or replace function public.analisis_producto_region(p_desde date, p_hasta date, p_cve_ent text default null, p_familia text default null)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare r jsonb;
begin
  perform exigir_analisis(1);
  with v as (
    select d.monto, coalesce(d.familia, 'sin_clasificar') familia, d.descripcion, c.cve_ent, c.cvegeo
    from ventas_detalle(p_desde, p_hasta) d left join clientes c on c.id = d.cliente_id
  ), nac as (
    select familia, sum(monto) monto, count(*) n from v group by familia
  ), tot as (select sum(monto) total, sum(n) n from nac)
  select jsonb_build_object(
    'total', round(coalesce(tot.total, 0), 2),
    'clasificado', jsonb_build_object(
      'pct', case when tot.total > 0 then round(1 - coalesce((select monto from nac where familia = 'sin_clasificar'), 0) / tot.total, 4) end,
      'sin_clasificar_monto', round(coalesce((select monto from nac where familia = 'sin_clasificar'), 0), 2),
      'sin_clasificar_ventas', coalesce((select n from nac where familia = 'sin_clasificar'), 0),
      'ventas', coalesce(tot.n, 0)),
    'familias', coalesce((select jsonb_agg(jsonb_build_object('clave', nac.familia, 'nombre', coalesce(f.nombre, 'Sin clasificar'),
        'monto', round(nac.monto, 2), 'ventas', nac.n, 'participacion', round(nac.monto / nullif(tot.total, 0), 4))
        order by coalesce(f.orden, 99)) from nac left join familias_venta f on f.clave = nac.familia), '[]'),
    'estados', coalesce((select jsonb_agg(jsonb_build_object('cve', e.cve_ent, 'nombre', e.nombre_corto, 'monto', round(x.monto, 2)) order by x.monto desc)
        from (select cve_ent, sum(monto) monto from v where cve_ent is not null group by 1) x join geo_estados e using (cve_ent)), '[]'),
    'matriz', coalesce((select jsonb_agg(jsonb_build_object('cve', x.cve_ent, 'familia', x.familia, 'monto', round(x.monto, 2)))
        from (select cve_ent, familia, sum(monto) monto from v where cve_ent is not null group by 1, 2) x), '[]'),
    'estado', case when p_cve_ent is not null then jsonb_build_object(
        'cve', p_cve_ent, 'nombre', (select nombre_corto from geo_estados where cve_ent = p_cve_ent),
        'total', (select round(coalesce(sum(monto), 0), 2) from v where cve_ent = p_cve_ent),
        -- Índice > 1: esa familia pesa más en el estado que en el país.
        'familias', coalesce((select jsonb_agg(jsonb_build_object('clave', x.familia, 'nombre', coalesce(f.nombre, 'Sin clasificar'), 'monto', round(x.monto, 2),
            'participacion', round(x.monto / x.t, 4), 'participacion_nacional', round(nac.monto / nullif(tot.total, 0), 4),
            'indice', round((x.monto / x.t) / nullif(nac.monto / nullif(tot.total, 0), 0), 2)) order by x.monto desc)
          from (select familia, sum(monto) monto, sum(sum(monto)) over () t from v where cve_ent = p_cve_ent group by familia) x
          join nac using (familia) left join familias_venta f on f.clave = x.familia), '[]'),
        'productos', coalesce((select jsonb_agg(jsonb_build_object('descripcion', y.descripcion, 'familia', y.familia, 'ventas', y.n, 'monto', round(y.monto, 2)) order by y.monto desc)
          from (select min(descripcion) descripcion, min(familia) familia, count(*) n, sum(monto) monto from v
                where cve_ent = p_cve_ent and descripcion is not null group by sin_acentos(btrim(descripcion)) order by sum(monto) desc limit 10) y), '[]'),
        'municipios', coalesce((select jsonb_agg(jsonb_build_object('cvegeo', m.cvegeo, 'nombre', m.nombre, 'monto', round(y.monto, 2)) order by y.monto desc)
          from (select cvegeo, sum(monto) monto from v where cve_ent = p_cve_ent and cvegeo is not null group by 1 order by 2 desc limit 8) y
          join geo_municipios m using (cvegeo)), '[]')) end,
    'familia', case when p_familia is not null then jsonb_build_object(
        'clave', p_familia, 'nombre', coalesce((select nombre from familias_venta where clave = p_familia), 'Sin clasificar'),
        'estados', coalesce((select jsonb_agg(jsonb_build_object('cve', x.cve_ent, 'monto', round(x.monto, 2), 'clientes', x.n) order by x.monto desc)
          from (select v.cve_ent, sum(v.monto) monto, count(*) n from v where v.familia = p_familia and v.cve_ent is not null group by 1) x), '[]')) end
  ) into r
  from tot;
  return r;
end $$;

create or replace function public.analisis_sin_clasificar(p_limite int default 80)
returns table (texto text, ejemplo text, ventas int, monto numeric, ultima date)
language plpgsql stable security invoker set search_path = public as $$
begin
  perform exigir_analisis(1);
  return query
    select sin_acentos(btrim(h.descripcion)), min(h.descripcion), count(*)::int, round(sum(h.monto), 2), max(h.fecha)
    from historial_ventas_hoja h
    where h.tipo = 'Venta' and h.familia is null and coalesce(btrim(h.descripcion), '') <> ''
    group by 1 order by sum(h.monto) desc limit p_limite;
end $$;

-- =============================================================================
-- 9. Planeación: meta anual repartida con la estacionalidad real
-- =============================================================================
create table if not exists public.metas_anuales (
  anio int primary key check (anio between 2018 and 2100),
  meta numeric(14,2) not null check (meta > 0),
  notas text,
  actualizado_por uuid default auth.uid() references public.perfiles(id),
  actualizado_en timestamptz not null default now()
);
create table if not exists public.metas_estado (
  anio int not null references public.metas_anuales(anio) on delete cascade,
  cve_ent text not null references public.geo_estados(cve_ent),
  meta numeric(14,2) not null check (meta >= 0),
  primary key (anio, cve_ent)
);

create or replace function public.guardar_meta_anual(p_anio int, p_meta numeric, p_notas text default null)
returns void language plpgsql security invoker set search_path = public as $$
begin
  perform exigir_analisis(3);
  if p_meta is null or p_meta <= 0 then raise exception 'La meta tiene que ser mayor que cero.' using errcode = '22023'; end if;
  insert into metas_anuales (anio, meta, notas) values (p_anio, round(p_meta, 2), p_notas)
  on conflict (anio) do update set meta = excluded.meta, notas = excluded.notas, actualizado_por = auth.uid(), actualizado_en = now();
end $$;

create or replace function public.guardar_meta_estado(p_anio int, p_cve_ent text, p_meta numeric)
returns void language plpgsql security invoker set search_path = public as $$
begin
  perform exigir_analisis(3);
  if not exists (select 1 from metas_anuales where anio = p_anio) then
    raise exception 'Primero captura la meta del año %.', p_anio using errcode = '22023';
  end if;
  if p_meta is null then
    delete from metas_estado where anio = p_anio and cve_ent = p_cve_ent;
  else
    insert into metas_estado (anio, cve_ent, meta) values (p_anio, p_cve_ent, round(p_meta, 2))
    on conflict (anio, cve_ent) do update set meta = excluded.meta;
  end if;
end $$;

-- Reparto por mes con la estacionalidad de los últimos 3 años completos: cada mes pesa lo que
-- pesó en esos años. Redondeado al centavo; la diferencia va a diciembre para que sume exacto.
create or replace function public.meta_por_mes(p_anio int, p_meta numeric)
returns table (mes int, estacionalidad numeric, meta numeric)
language sql stable security invoker set search_path = public as $$
  with base as (
    select least(p_anio - 1, extract(year from hoy_planta())::int - 1) ult
  ), hist as (
    select extract(month from d.fecha)::int mes, sum(d.monto) monto
    from base, ventas_detalle(make_date(base.ult - 2, 1, 1), make_date(base.ult, 12, 31)) d group by 1
  ), pesos as (
    select g.mes, case when (select sum(monto) from hist) > 0 then coalesce(h.monto, 0) / (select sum(monto) from hist) else 1.0 / 12 end w
    from generate_series(1, 12) g(mes) left join hist h using (mes)
  ), r as (
    select mes, w, round(p_meta * w, 2) m from pesos
  )
  select r.mes, round(r.w, 6),
    case when r.mes = 12 then round(p_meta, 2) - (select sum(m) from r where r.mes < 12) else r.m end
  from r order by r.mes
$$;

create or replace function public.analisis_planeacion(p_anio int default null, p_crecimiento numeric default null)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_hoy date := hoy_planta();
  v_anio int := coalesce(p_anio, extract(year from hoy_planta())::int);
  v_ini date := make_date(v_anio, 1, 1);
  v_fin date := make_date(v_anio, 12, 31);
  v_corte date := least(v_hoy, make_date(v_anio, 12, 31));
  v_ult int := least(v_anio - 1, extract(year from hoy_planta())::int - 1);
  m metas_anuales;
  v_ant numeric; v_misma numeric; v_real numeric; v_meta numeric; v_propuesta numeric;
  v_meses_rest numeric; v_meses_pas numeric; v_meta_fecha numeric;
  r jsonb;
begin
  perform exigir_analisis(1);
  select * into m from metas_anuales where anio = v_anio;
  v_ant := ventas_entre(make_date(v_anio - 1, 1, 1), make_date(v_anio - 1, 12, 31));
  v_misma := ventas_entre(make_date(v_anio - 1, 1, 1), (v_corte - interval '1 year')::date);
  v_real := case when v_corte >= v_ini then ventas_entre(v_ini, v_corte) else 0 end;
  v_propuesta := case when p_crecimiento is not null then round(v_ant * (1 + p_crecimiento), -3) end;
  v_meta := coalesce(m.meta, v_propuesta);
  -- Meses que faltan contando el que corre (en octubre: octubre, noviembre y diciembre).
  v_meses_rest := case when v_hoy < v_ini then 12 when v_hoy > v_fin then 0 else 12 - extract(month from v_hoy) + 1 end;
  v_meses_pas := case when v_hoy < v_ini then 0 when v_hoy > v_fin then 12
                      else (v_hoy - v_ini + 1) / ((v_fin - v_ini + 1) / 12.0) end;

  with pm as (select * from meta_por_mes(v_anio, coalesce(v_meta, 1))),
  reales as (select extract(month from d.fecha)::int mes, sum(d.monto) monto
             from ventas_detalle(v_ini, v_corte) d where v_corte >= v_ini group by 1),
  meses as (
    select pm.mes, pm.estacionalidad, case when v_meta is not null then pm.meta end meta,
      case when make_date(v_anio, pm.mes, 1) <= v_hoy then round(coalesce(rl.monto, 0), 2) end real
    from pm left join reales rl using (mes)
  ), acum as (
    select meses.*, sum(meta) over (order by mes) meta_acum, sum(real) over (order by mes) real_acum from meses
  )
  -- Meta a la fecha: los meses cerrados completos y la parte del mes en curso que ya pasó.
  select coalesce(sum(case when make_date(v_anio, mes, 1) + interval '1 month' <= v_hoy then meta
                           when make_date(v_anio, mes, 1) <= v_hoy
                             then meta * extract(day from v_hoy) / extract(day from (make_date(v_anio, mes, 1) + interval '1 month - 1 day'))
                           else 0 end), 0),
    jsonb_agg(jsonb_build_object('mes', mes, 'estacionalidad', estacionalidad, 'meta', meta, 'real', real,
      'meta_acumulada', meta_acum, 'real_acumulado', case when real is not null then real_acum end) order by mes)
  into v_meta_fecha, r
  from acum;

  return jsonb_build_object(
    'anio', v_anio, 'hoy', v_hoy,
    'meta', m.meta, 'notas', m.notas, 'actualizado_en', m.actualizado_en,
    'meta_propuesta', v_propuesta, 'crecimiento', p_crecimiento,
    'meta_usada', v_meta,
    'anio_anterior', round(v_ant, 2),
    'base_estacionalidad', jsonb_build_array(v_ult - 2, v_ult),
    'meses', r,
    'avance', jsonb_build_object(
      'real', round(v_real, 2),
      'meta_a_la_fecha', case when v_meta is not null then round(v_meta_fecha, 2) end,
      'pct', case when v_meta > 0 then round(v_real / v_meta, 4) end,
      'faltante', case when v_meta is not null then round(greatest(v_meta - v_real, 0), 2) end,
      'meses_restantes', v_meses_rest,
      'ritmo_necesario', case when v_meta is not null and v_meses_rest > 0 then round(greatest(v_meta - v_real, 0) / v_meses_rest, 2) end,
      'ritmo_actual', case when v_meses_pas > 0 then round(v_real / v_meses_pas, 2) end,
      -- Igual que el tablero: si vamos X % arriba a la misma fecha, cerramos X % arriba.
      'proyeccion', case when v_misma > 0 and v_ant > 0 then round(v_ant * v_real / v_misma, 2) end,
      'anio_anterior_misma_fecha', round(v_misma, 2)),
    'estados', (select coalesce(jsonb_agg(jsonb_build_object('cve', e.cve_ent, 'nombre', e.nombre_corto,
        'participacion', round(b.monto / nullif(b.t, 0), 4),
        'meta_sugerida', case when v_meta is not null then round(v_meta * b.monto / nullif(b.t, 0), -3) end,
        'meta', me.meta, 'real', round(coalesce(rr.monto, 0), 2)) order by b.monto desc), '[]')
      from (select c.cve_ent, sum(d.monto) monto, sum(sum(d.monto)) over () t
            from ventas_detalle(make_date(v_ult - 2, 1, 1), make_date(v_ult, 12, 31)) d join clientes c on c.id = d.cliente_id
            where c.cve_ent is not null group by 1) b
      join geo_estados e using (cve_ent)
      left join metas_estado me on me.anio = v_anio and me.cve_ent = b.cve_ent
      left join (select c.cve_ent, sum(d.monto) monto from ventas_detalle(v_ini, v_corte) d join clientes c on c.id = d.cliente_id
                 where v_corte >= v_ini group by 1) rr on rr.cve_ent = b.cve_ent)
  );
end $$;

-- =============================================================================
-- 10. RLS de lo nuevo
-- =============================================================================
alter table public.geo_estados enable row level security;
alter table public.geo_municipios enable row level security;
alter table public.geo_alias_estado enable row level security;
alter table public.geo_alias_ciudad enable row level security;
alter table public.familias_venta enable row level security;
alter table public.reglas_familia_venta enable row level security;
alter table public.familia_categoria enable row level security;
alter table public.metas_anuales enable row level security;
alter table public.metas_estado enable row level security;

-- El catálogo del INEGI y los nombres de familia son públicos para quien tiene un rol.
drop policy if exists ver on public.geo_estados;
create policy ver on public.geo_estados for select to authenticated using ((select cardinality(mis_roles())) > 0);
drop policy if exists ver on public.geo_municipios;
create policy ver on public.geo_municipios for select to authenticated using ((select cardinality(mis_roles())) > 0);
drop policy if exists ver on public.geo_alias_estado;
create policy ver on public.geo_alias_estado for select to authenticated using ((select cardinality(mis_roles())) > 0);
drop policy if exists ver on public.familias_venta;
create policy ver on public.familias_venta for select to authenticated using ((select cardinality(mis_roles())) > 0);
-- Alias, reglas y metas: los ve el análisis; se escriben con las funciones de arriba
-- (alias y reglas) o directo si se es dirección (metas y familia por categoría).
drop policy if exists ver on public.geo_alias_ciudad;
create policy ver on public.geo_alias_ciudad for select to authenticated using ((select puede('analisis', 1)));
drop policy if exists ver on public.reglas_familia_venta;
create policy ver on public.reglas_familia_venta for select to authenticated using ((select puede('analisis', 1)));
drop policy if exists ver on public.familia_categoria;
create policy ver on public.familia_categoria for select to authenticated using ((select puede('analisis', 1)));
drop policy if exists editar on public.familia_categoria;
create policy editar on public.familia_categoria for all to authenticated
  using ((select puede('analisis', 3))) with check ((select puede('analisis', 3)));
drop policy if exists ver on public.metas_anuales;
create policy ver on public.metas_anuales for select to authenticated using ((select puede('analisis', 1)));
drop policy if exists editar on public.metas_anuales;
create policy editar on public.metas_anuales for all to authenticated
  using ((select puede('analisis', 3))) with check ((select puede('analisis', 3)));
drop policy if exists ver on public.metas_estado;
create policy ver on public.metas_estado for select to authenticated using ((select puede('analisis', 1)));
drop policy if exists editar on public.metas_estado;
create policy editar on public.metas_estado for all to authenticated
  using ((select puede('analisis', 3))) with check ((select puede('analisis', 3)));

drop trigger if exists auditar on public.metas_anuales;
create trigger auditar after insert or update or delete on public.metas_anuales for each row execute function public.auditar();
drop trigger if exists auditar on public.reglas_familia_venta;
create trigger auditar after insert or update or delete on public.reglas_familia_venta for each row execute function public.auditar();
drop trigger if exists auditar on public.geo_alias_ciudad;
create trigger auditar after insert or update or delete on public.geo_alias_ciudad for each row execute function public.auditar();

-- =============================================================================
-- 11. Hallazgos para el asistente y el resumen de dirección
-- =============================================================================
create or replace function public.hallazgos_analisis(p_area text)
returns table (area text, tono text, titulo text, detalle text, ruta text, peso int)
language plpgsql stable security invoker set search_path = public as $$
declare
  v_hoy date := hoy_planta();
  z jsonb; u jsonb; p jsonb; k numeric;
begin
  if not puede('analisis', 1) or coalesce(p_area, 'direccion') not in ('direccion', 'ventas') then return; end if;

  -- La zona que más dinero dejó de comprar en los últimos 12 meses contra los 12 anteriores.
  z := analisis_zonas_frias((v_hoy - interval '1 year')::date + 1, v_hoy, null, 0.3, 1) #> '{zonas,0}';
  if z is not null and (z->>'perdido')::numeric > 0 then
    return query select 'ventas'::text, 'atencion'::text,
      format('%s compró %s %% menos que el año anterior', z->>'nombre', abs(round((z->>'cambio')::numeric * 100))),
      format('Son %s menos en los últimos 12 meses; %s %s dejaron de comprar ahí.', texto_dinero((z->>'perdido')::numeric),
             z->>'clientes_perdidos', case when (z->>'clientes_perdidos')::int = 1 then 'cliente' else 'clientes' end),
      '/analisis'::text, 45;
  end if;

  if p_area = 'direccion' then
    -- La meta del año, si hay una y el ritmo necesario se separa del que se lleva.
    p := analisis_planeacion(extract(year from v_hoy)::int);
    if p->>'meta' is not null and (p #>> '{avance,ritmo_actual}')::numeric > 0 then
      k := (p #>> '{avance,ritmo_necesario}')::numeric / (p #>> '{avance,ritmo_actual}')::numeric;
      if k >= 1.15 then
        return query select 'direccion'::text, case when k >= 1.4 then 'riesgo' else 'atencion' end,
          format('Para la meta de %s hay que vender %s al mes', texto_dinero((p->>'meta')::numeric),
                 texto_dinero((p #>> '{avance,ritmo_necesario}')::numeric)),
          format('El promedio del año va en %s al mes; faltan %s.', texto_dinero((p #>> '{avance,ritmo_actual}')::numeric),
                 texto_dinero((p #>> '{avance,faltante}')::numeric)),
          '/analisis/planeacion'::text, 30;
      end if;
    end if;

    -- Que el mapa diga la verdad: cuánto del dinero no tiene municipio.
    select jsonb_build_object('pct', sum(d.monto) filter (where c.cvegeo is not null) / nullif(sum(d.monto), 0))
      into u from ventas_detalle((v_hoy - interval '3 years')::date, v_hoy) d left join clientes c on c.id = d.cliente_id
      where c.ubicacion is distinct from 'extranjero';
    if (u->>'pct')::numeric < 0.85 then
      return query select 'direccion'::text, 'info'::text,
        format('El %s %% de lo vendido no tiene municipio', round((1 - (u->>'pct')::numeric) * 100)),
        'Hay ciudades escritas de forma que no se reconocen. Corregirlas una vez afina el mapa para siempre.'::text,
        '/analisis/ubicaciones'::text, 80;
    end if;
  end if;
end $$;

select public.optimizar_politicas();
