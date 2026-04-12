// dictnames.js — dictionary metadata: display labels, tier, defLang, subgroup.
// Exposes window.DictNames.label(name) → {label, group, lang, tier, defLang, subgroup}.
//
// tier: 1=primary (auto-expand), 2=specialized (expand on exact), 3=supplementary (hidden)
// defLang: en, de, fr, la, bo, sa, zh, mixed, equiv (equivalence lists)
// subgroup: core, grammar, scan, subcollection, domain, native, reverse, equiv

(function () {
  // ── Sanskrit XDXF dictionaries ─────────────────────────────────────
  const SKT = {
    // Tier 1 — primary
    "mwse.dict":    { label: "Monier-Williams (1899)",  tier: 1, defLang: "en", subgroup: "core", family: "mw", source: "xdxf" },
    "aptees.dict":  { label: "Apte (Skt\u2192Eng)",     tier: 1, defLang: "en", subgroup: "core", family: "apte", source: "xdxf" },
    "cappse.dict":  { label: "Cappeller (Skt\u2192Eng)", tier: 1, defLang: "en", subgroup: "core", source: "xdxf" },
    "macdse.dict":  { label: "Macdonell (Skt\u2192Eng)", tier: 1, defLang: "en", subgroup: "core", family: "macdonell", source: "xdxf" },
    "pwg.dict":     { label: "B\u00f6htlingk-Roth (PWG)", tier: 1, defLang: "de", subgroup: "core", source: "xdxf" },
    "pwk.dict":     { label: "B\u00f6htlingk k\u00fcrzer (pw)", tier: 1, defLang: "de", subgroup: "core", source: "xdxf" },

    // Tier 2 — specialized
    "vcpss.dict":   { label: "V\u0101caspatyam",         tier: 2, defLang: "sa", subgroup: "native", source: "xdxf" },
    "skdss.dict":   { label: "\u015aabda-kalpa-druma",    tier: 2, defLang: "sa", subgroup: "native", source: "xdxf" },
    "stcsf.dict":   { label: "Stchoupak (Skt\u2192Fr)",  tier: 2, defLang: "fr", subgroup: "core", source: "xdxf" },
    "bursf.dict":   { label: "Burnouf (Skt\u2192Fr)",    tier: 2, defLang: "fr", subgroup: "core", source: "xdxf" },
    "cappsg.dict":  { label: "Cappeller (Skt\u2192Ger)", tier: 2, defLang: "de", subgroup: "core", source: "xdxf" },
    "grasg_a.dict": { label: "Grassmann Vedic",          tier: 2, defLang: "de", subgroup: "grammar", source: "xdxf" },
    "benfse.dict":  { label: "Benfey (Skt\u2192Eng)",    tier: 2, defLang: "en", subgroup: "core", source: "xdxf" },
    "mwse72.dict":  { label: "MW (1872)",                tier: 2, defLang: "en", subgroup: "core", family: "mw", source: "xdxf" },
    "schnzsw.dict": { label: "Schmidt Nachtr\u00e4ge",   tier: 2, defLang: "de", subgroup: "core", source: "xdxf" },
    "boppsl.dict":  { label: "Bopp (Skt\u2192Lat)",      tier: 2, defLang: "la", subgroup: "core", source: "xdxf" },

    // Tier 3 — reverse / supplementary
    "aptese.dict":  { label: "Apte (Eng\u2192Skt)",      tier: 3, defLang: "en", subgroup: "reverse", family: "apte", source: "xdxf" },
    "bores.dict":   { label: "Borooah (Eng\u2192Skt)",   tier: 3, defLang: "en", subgroup: "reverse", source: "xdxf" },
    "mwes.dict":    { label: "MW Eng\u2192Skt",          tier: 3, defLang: "en", subgroup: "reverse", family: "mw", source: "xdxf" },
  };

  // ── SANDIC dictionaries ──────────────────────────────────────────────
  const SANDIC = {
    "mwse.sandic":        { label: "MW (SANDIC)",          tier: 2, defLang: "en", subgroup: "core", family: "mw", source: "sandic" },
    "aptese.sandic":      { label: "Apte (SANDIC)",        tier: 2, defLang: "en", subgroup: "core", family: "apte", source: "sandic" },
    "macdse.sandic":      { label: "Macdonell (SANDIC)",   tier: 2, defLang: "en", subgroup: "core", family: "macdonell", source: "sandic" },
    "dhatupatha.sandic":  { label: "Dh\u0101tup\u0101\u1e6dha (SANDIC)", tier: 2, defLang: "en", subgroup: "grammar", family: "dhatupatha", source: "sandic" },
  };

  // ── GRETIL HTML dictionaries ─────────────────────────────────────────
  const GRETIL = {
    "grasg_p.gretil":     { label: "Grassmann Rig-Veda (P)", tier: 2, defLang: "de", subgroup: "grammar", source: "gretil" },
    "pese.gretil":        { label: "Pur\u0101\u1e47ic Encyclopaedia", tier: 2, defLang: "en", subgroup: "domain", source: "gretil" },
    "vedconc.gretil":     { label: "Vedic Concordance", tier: 2, defLang: "en", subgroup: "domain", family: "vedconc", source: "gretil" },
  };

  // ── Apple dictionaries ───────────────────────────────────────────────
  const APPLE = {
    // Tier 1 — major unique dictionaries
    "bhsd.apple":         { label: "BHSD (Buddhist Hybrid Skt)", tier: 1, defLang: "en", subgroup: "core", source: "apple" },
    "kalpadruma.apple":   { label: "\u015aabdakalpadruma",  tier: 1, defLang: "sa", subgroup: "native", source: "apple" },
    "vacaspatyam.apple":  { label: "V\u0101caspatyam",     tier: 1, defLang: "sa", subgroup: "native", source: "apple" },
    "pali-en.apple":      { label: "P\u0101li\u2192English", tier: 1, defLang: "en", subgroup: "core", source: "apple" },
    "bod-rgya.apple":     { label: "Tibetan Great Dict (\u0f56\u0f7c\u0f51\u0f0b\u0f62\u0f92\u0fb1)", tier: 1, defLang: "bo", subgroup: "native", source: "apple" },

    // Tier 2 — specialized
    "apte-bi.apple":      { label: "Apte Bilingual",       tier: 2, defLang: "en", subgroup: "core", family: "apte", source: "apple" },
    "mw-sdt.apple":       { label: "MW (Skt-Deva-Tib)",    tier: 2, defLang: "en", subgroup: "core", family: "mw", source: "apple" },
    "amara.apple":        { label: "Amarako\u015ba",        tier: 2, defLang: "sa", subgroup: "native", source: "apple" },
    "amara-ctx.apple":    { label: "Amarako\u015ba (context)", tier: 2, defLang: "sa", subgroup: "native", source: "apple" },
    "amara-onto.apple":   { label: "Amarako\u015ba (ontology)", tier: 2, defLang: "sa", subgroup: "native", source: "apple" },
    "bloomfield.apple":   { label: "Bloomfield Vedic Conc.", tier: 2, defLang: "en", subgroup: "domain", family: "vedconc", source: "apple" },
    "dcs-freq.apple":     { label: "DCS Word Frequency",   tier: 2, defLang: "en", subgroup: "domain", source: "apple" },
    "dhatupatha-kr.apple":{ label: "Dh\u0101tup\u0101\u1e6dha (K\u1e5b\u1e63\u1e47\u0101c\u0101rya)", tier: 2, defLang: "sa", subgroup: "grammar", family: "dhatupatha", source: "apple" },
    "dhatupatha-sa.apple":{ label: "Dh\u0101tup\u0101\u1e6dha", tier: 2, defLang: "sa", subgroup: "grammar", family: "dhatupatha", source: "apple" },
    "chandas.apple":      { label: "Chandas (Prosody)",     tier: 2, defLang: "sa", subgroup: "grammar", source: "apple" },
    "ashtadhyayi-en.apple":{ label: "A\u1e63\u1e6d\u0101dhy\u0101y\u012b (English)", tier: 2, defLang: "en", subgroup: "grammar", source: "apple" },
    "ashtadhyayi-anv.apple":{ label: "A\u1e63\u1e6d\u0101dhy\u0101y\u012b (Anuv\u1e5btti)", tier: 2, defLang: "sa", subgroup: "grammar", source: "apple" },
    "bopp.apple":         { label: "Bopp Comparative",      tier: 2, defLang: "en", subgroup: "grammar", source: "apple" },
    "vedic-rituals.apple":{ label: "Vedic Rituals (Hillebrandt)", tier: 2, defLang: "en", subgroup: "domain", source: "apple" },
    "abhyankar.apple":    { label: "Abhyankar Grammar Dict", tier: 2, defLang: "en", subgroup: "grammar", source: "apple" },
    "siddh-kaumudi.apple":{ label: "Siddh\u0101nta Kaumud\u012b", tier: 2, defLang: "sa", subgroup: "grammar", source: "apple" },
    "jnu-tinanta.apple":  { label: "Ti\u1e45anta (JNU Verbs)", tier: 2, defLang: "sa", subgroup: "grammar", source: "apple" },

    // Tier 3 — misc
    "ekaksara.apple":     { label: "Ek\u0101k\u1e63aran\u0101mam\u0101l\u0101", tier: 3, defLang: "sa", subgroup: "native", source: "apple" },
    "computer-skt.apple": { label: "Computer Terms (Skt)",  tier: 3, defLang: "en", subgroup: "domain", source: "apple" },

    // Heritage Declension — Series A san-eng (10 volumes)
    "decl-a01.apple":     { label: "Heritage Decl A-01 (san\u2192eng)", tier: 2, defLang: "en", subgroup: "grammar", family: "heritage-decl", source: "apple" },
    "decl-a02.apple":     { label: "Heritage Decl A-02 (san\u2192eng)", tier: 2, defLang: "en", subgroup: "grammar", family: "heritage-decl", source: "apple" },
    "decl-a03.apple":     { label: "Heritage Decl A-03 (san\u2192eng)", tier: 2, defLang: "en", subgroup: "grammar", family: "heritage-decl", source: "apple" },
    "decl-a04.apple":     { label: "Heritage Decl A-04 (san\u2192eng)", tier: 2, defLang: "en", subgroup: "grammar", family: "heritage-decl", source: "apple" },
    "decl-a05.apple":     { label: "Heritage Decl A-05 (san\u2192eng)", tier: 2, defLang: "en", subgroup: "grammar", family: "heritage-decl", source: "apple" },
    "decl-a06.apple":     { label: "Heritage Decl A-06 (san\u2192eng)", tier: 2, defLang: "en", subgroup: "grammar", family: "heritage-decl", source: "apple" },
    "decl-a07.apple":     { label: "Heritage Decl A-07 (san\u2192eng)", tier: 2, defLang: "en", subgroup: "grammar", family: "heritage-decl", source: "apple" },
    "decl-a08.apple":     { label: "Heritage Decl A-08 (san\u2192eng)", tier: 2, defLang: "en", subgroup: "grammar", family: "heritage-decl", source: "apple" },
    "decl-a09.apple":     { label: "Heritage Decl A-09 (san\u2192eng)", tier: 2, defLang: "en", subgroup: "grammar", family: "heritage-decl", source: "apple" },
    "decl-a10.apple":     { label: "Heritage Decl A-10 (san\u2192eng)", tier: 2, defLang: "en", subgroup: "grammar", family: "heritage-decl", source: "apple" },
    // Heritage Declension — Series A san-san (5 volumes)
    "decl-a1-ss.apple":   { label: "Heritage Decl A-1 (san\u2192san)", tier: 2, defLang: "sa", subgroup: "grammar", family: "heritage-decl", source: "apple" },
    "decl-a2-ss.apple":   { label: "Heritage Decl A-2 (san\u2192san)", tier: 2, defLang: "sa", subgroup: "grammar", family: "heritage-decl", source: "apple" },
    "decl-a3-ss.apple":   { label: "Heritage Decl A-3 (san\u2192san)", tier: 2, defLang: "sa", subgroup: "grammar", family: "heritage-decl", source: "apple" },
    "decl-a4-ss.apple":   { label: "Heritage Decl A-4 (san\u2192san)", tier: 2, defLang: "sa", subgroup: "grammar", family: "heritage-decl", source: "apple" },
    "decl-a5-ss.apple":   { label: "Heritage Decl A-5 (san\u2192san)", tier: 2, defLang: "sa", subgroup: "grammar", family: "heritage-decl", source: "apple" },
    // Heritage Declension — Series B san-eng (3 volumes)
    "decl-b1.apple":      { label: "Heritage Decl B-1 (san\u2192eng)", tier: 2, defLang: "en", subgroup: "grammar", family: "heritage-decl", source: "apple" },
    "decl-b2.apple":      { label: "Heritage Decl B-2 (san\u2192eng)", tier: 2, defLang: "en", subgroup: "grammar", family: "heritage-decl", source: "apple" },
    "decl-b3.apple":      { label: "Heritage Decl B-3 (san\u2192eng)", tier: 2, defLang: "en", subgroup: "grammar", family: "heritage-decl", source: "apple" },
    // Heritage Declension — Series B san-san (1 volume)
    "decl-b-ss.apple":    { label: "Heritage Decl B (san\u2192san)",   tier: 2, defLang: "sa", subgroup: "grammar", family: "heritage-decl", source: "apple" },
  };

  // ── Tibetan dicts (Steinert collection) ────────────────────────────
  const TIB = {
    // Tier 1 — primary
    "tib_02-RangjungYeshe":              { label: "Rangjung Yeshe",              tier: 1, defLang: "en",    subgroup: "core" },
    "tib_01-Hopkins2015":                { label: "Hopkins 2015",                tier: 1, defLang: "en",    subgroup: "core" },
    "tib_43-84000Dict":                  { label: "84000 Dictionary",            tier: 1, defLang: "en",    subgroup: "core" },
    "tib_25-tshig-mdzod-chen-mo-Tib":    { label: "Tshig mdzod chen mo (Tib)",   tier: 1, defLang: "bo",    subgroup: "native" },

    // Tier 2 — specialized (English)
    "tib_03-Berzin":                     { label: "Berzin",                      tier: 2, defLang: "en",    subgroup: "core" },
    "tib_04-Berzin-Def":                 { label: "Berzin (Definitions)",        tier: 2, defLang: "en",    subgroup: "core" },
    "tib_05-Hackett-Def2015":            { label: "Hackett Definitions 2015",    tier: 2, defLang: "en",    subgroup: "core" },
    "tib_05-Hopkins-Def2015":            { label: "Hopkins Definitions 2015",    tier: 2, defLang: "en",    subgroup: "subcollection" },
    "tib_09-DanMartin":                  { label: "Dan Martin",                  tier: 2, defLang: "en",    subgroup: "core" },
    "tib_10-RichardBarron":              { label: "Richard Barron",              tier: 2, defLang: "en",    subgroup: "core" },
    "tib_33-TsepakRigdzin":             { label: "Tsepak Rigdzin",              tier: 2, defLang: "en",    subgroup: "core" },
    "tib_35-ThomasDoctor":              { label: "Thomas Doctor",               tier: 2, defLang: "en",    subgroup: "core" },
    "tib_44-84000Definitions":           { label: "84000 Definitions",           tier: 2, defLang: "en",    subgroup: "core" },
    "tib_48-TibTermProject":             { label: "TibTerm Project",             tier: 2, defLang: "en",    subgroup: "domain" },
    "tib_23-GatewayToKnowledge":         { label: "Gateway to Knowledge",        tier: 2, defLang: "en",    subgroup: "core" },
    "tib_38-Gaeng,Wetzel":               { label: "Gaeng & Wetzel",              tier: 2, defLang: "en",    subgroup: "core" },
    "tib_40-CommonTerms-Lin":            { label: "Common Terms (Lin)",          tier: 2, defLang: "en",    subgroup: "core" },

    // Tier 2 — specialized (Tibetan native)
    "tib_34-dung-dkar-tshig-mdzod-chen-mo-Tib": { label: "Dung dkar tshig mdzod (Tib)", tier: 2, defLang: "bo", subgroup: "native" },
    "tib_37-dag_tshig_gsar_bsgrigs-Tib": { label: "Dag tshig gsar bsgrigs",     tier: 2, defLang: "bo",    subgroup: "native" },

    // Tier 2 — specialized (Sanskrit equivalence)
    "tib_50-NegiSkt":                    { label: "Negi Tib\u2192Skt",           tier: 2, defLang: "equiv", subgroup: "equiv" },
    "tib_49-LokeshChandraSkt":           { label: "Lokesh Chandra Skt",          tier: 2, defLang: "equiv", subgroup: "equiv" },
    "tib_46-84000Skt":                   { label: "84000 Sanskrit",              tier: 2, defLang: "equiv", subgroup: "equiv" },
    "tib_15-Hopkins-Skt1992":            { label: "Hopkins Skt (1992)",          tier: 2, defLang: "equiv", subgroup: "equiv" },
    "tib_15-Hopkins-Skt2015":            { label: "Hopkins Skt (2015)",          tier: 2, defLang: "equiv", subgroup: "equiv" },
    "tib_21-Mahavyutpatti-Skt":          { label: "Mah\u0101vyutpatti (Skt)",    tier: 2, defLang: "equiv", subgroup: "equiv" },
    "tib_45-84000Synonyms":              { label: "84000 Synonyms",              tier: 2, defLang: "equiv", subgroup: "equiv" },

    // Tier 2 — specialized (other)
    "tib_22-Yoghacharabhumi-glossary":   { label: "Yog\u0101c\u0101rabh\u016bmi glossary", tier: 2, defLang: "en", subgroup: "domain" },
    "tib_26-Verbinator":                 { label: "Verbinator (verbs)",          tier: 2, defLang: "en",    subgroup: "grammar" },
    "tib_42-Sera-Textbook-Definitions":  { label: "Sera Textbook Definitions",   tier: 2, defLang: "en",    subgroup: "domain" },

    // Tier 3 — supplementary (Hopkins subcollections)
    "tib_06-Hopkins-Comment":            { label: "Hopkins Comments",             tier: 3, defLang: "en",    subgroup: "subcollection" },
    "tib_11-Hopkins-Divisions2015":      { label: "Hopkins Divisions",            tier: 3, defLang: "en",    subgroup: "subcollection" },
    "tib_12-Hopkins-Divisions,Tib2015":  { label: "Hopkins Divisions (Tib)",      tier: 3, defLang: "bo",    subgroup: "subcollection" },
    "tib_13-Hopkins-Examples":           { label: "Hopkins Examples",              tier: 3, defLang: "en",    subgroup: "subcollection" },
    "tib_14-Hopkins-Examples,Tib":       { label: "Hopkins Examples (Tib)",        tier: 3, defLang: "bo",    subgroup: "subcollection" },
    "tib_16-Hopkins-Synonyms1992":       { label: "Hopkins Synonyms 1992",        tier: 3, defLang: "en",    subgroup: "subcollection" },
    "tib_17-Hopkins-TibetanSynonyms1992":     { label: "Hopkins Tib Synonyms 1992",     tier: 3, defLang: "bo", subgroup: "subcollection" },
    "tib_17-Hopkins-TibetanSynonyms2015":     { label: "Hopkins Tib Synonyms 2015",     tier: 3, defLang: "bo", subgroup: "subcollection" },
    "tib_18-Hopkins-TibetanDefinitions2015":  { label: "Hopkins Tib Definitions",        tier: 3, defLang: "bo", subgroup: "subcollection" },
    "tib_19-Hopkins-TibetanTenses2015":       { label: "Hopkins Tib Tenses",             tier: 3, defLang: "bo", subgroup: "subcollection" },
    "tib_20-Hopkins-others'English2015":      { label: "Hopkins (others, Eng)",           tier: 3, defLang: "en", subgroup: "subcollection" },

    // Tier 3 — large supplementary
    "tib_07-JimValby":                   { label: "Jim Valby",                    tier: 3, defLang: "en",    subgroup: "core" },
    "tib_08-IvesWaldo":                  { label: "Ives Waldo",                   tier: 3, defLang: "en",    subgroup: "core" },

    // Tier 3 — scans
    "tib_63-Mahavyutpatti-Scan-1989":    { label: "Mah\u0101vyutpatti (Scan 1989)", tier: 3, defLang: "mixed", subgroup: "scan" },
    "tib_65-ChandraDas_Scan":            { label: "Chandra Das (Scan)",            tier: 3, defLang: "en",    subgroup: "scan" },
    "tib_66-Jaeschke_Scan":              { label: "Jaeschke (Scan)",               tier: 3, defLang: "en",    subgroup: "scan" },

    // Tier 3 — native Tibetan specialized
    "tib_54-bod_rgya_nang_don_rig_pai_tshig_mdzod": { label: "Bod rgya nang don tshig mdzod", tier: 3, defLang: "bo", subgroup: "native" },
    "tib_55-brda_dkrol_gser_gyi_me_long":            { label: "Brda dkrol gser gyi me long",   tier: 3, defLang: "bo", subgroup: "native" },
    "tib_56-chos_rnam_kun_btus":                     { label: "Chos rnam kun btus",             tier: 3, defLang: "bo", subgroup: "native" },
    "tib_57-li_shii_gur_khang":                      { label: "Li shii gur khang",              tier: 3, defLang: "bo", subgroup: "native" },
    "tib_58-sgom_sde_tshig_mdzod_chen_mo":           { label: "Sgom sde tshig mdzod",           tier: 3, defLang: "bo", subgroup: "native" },
    "tib_59-sgra_bye_brag_tu_rtogs_byed_chen_mo":    { label: "Sgra bye brag tu rtogs byed",    tier: 3, defLang: "bo", subgroup: "native" },
    "tib_60-sngas_rgyas_chos_gzhung_tshig_mdzod":    { label: "Sangs rgyas chos gzhung tshig mdzod", tier: 3, defLang: "bo", subgroup: "native" },
    "tib_61-gangs_can_mkhas_grub_rim_byon_ming_mdzod": { label: "Gangs can mkhas grub ming mdzod",  tier: 3, defLang: "bo", subgroup: "native" },
    "tib_62-bod_yig_tshig_gter_rgya_mtsho":          { label: "Bod yig tshig gter rgya mtsho",  tier: 3, defLang: "bo", subgroup: "native" },
    "tib_64-sgra-sbyor-bam-po-gnyis-pa":             { label: "Sgra sbyor bam po gnyis pa",     tier: 3, defLang: "bo", subgroup: "native" },

    // Tier 3 — misc / special
    "tib_36-ComputerTerms":              { label: "Computer Terms",               tier: 3, defLang: "en",    subgroup: "domain" },
    "tib_47-Misc":                       { label: "Misc",                         tier: 3, defLang: "mixed", subgroup: "domain" },
    "tib_51-LaineAbbreviations":         { label: "Laine Abbreviations",          tier: 3, defLang: "en",    subgroup: "domain" },
    "tib_52-ITLR":                       { label: "ITLR",                         tier: 3, defLang: "en",    subgroup: "domain" },
    "tib_53-Bialek":                     { label: "Bialek",                       tier: 3, defLang: "en",    subgroup: "core" },
    "tib_67-hotl1":                      { label: "HOTL 1",                       tier: 3, defLang: "en",    subgroup: "domain" },
    "tib_67-hotl2":                      { label: "HOTL 2",                       tier: 3, defLang: "en",    subgroup: "domain" },
    "tib_67-hotl3":                      { label: "HOTL 3",                       tier: 3, defLang: "en",    subgroup: "domain" },
    "tib_68-tibetanlanguage-school":     { label: "Tibetan Language School",       tier: 3, defLang: "en",    subgroup: "domain" },
  };

  // ── Display group classification ───────────────────────────────────
  // Maps defLang to display group index and metadata.
  const DISPLAY_GROUPS = [
    { id: "en",     name: "\uc601\uc5b4 \ud480\uc774",          nameEn: "English",         color: "#4a7ab5" },
    { id: "de",     name: "\ub3c5\uc77c\uc5b4 \ud480\uc774",     nameEn: "Deutsch",         color: "#8a6a3a" },
    { id: "fr-la",  name: "\ubd88\uc5b4\u00b7\ub77c\ud2f4\uc5b4", nameEn: "Fran\u00e7ais / Latin", color: "#6a5a8a" },
    { id: "equiv",  name: "\ub300\uc5ed\uc5b4\u00b7\ubc94\uc5b4 \ub4f1\uac00", nameEn: "Equivalents",     color: "#5a8a5a" },
    { id: "native", name: "\uc6d0\uc5b4 \ud480\uc774",          nameEn: "Native",          color: "#8a5a5a" },
    { id: "aux",    name: "\ubcf4\uc870\u00b7\uc2a4\uce94",       nameEn: "Auxiliary",       color: "#aaa" },
  ];

  function getDisplayGroupIndex(meta) {
    if (meta.tier === 3) return 5; // aux
    switch (meta.defLang) {
      case "en": return 0;
      case "de": return 1;
      case "fr": case "la": return 2;
      case "equiv": return 3;
      case "bo": case "sa": return 4;
      default: return 5;
    }
  }

  // All dictionaries merged for lookup
  const ALL = Object.assign({}, SKT, SANDIC, GRETIL, APPLE, TIB);

  function label(name) {
    if (ALL[name]) {
      const s = ALL[name];
      // Determine group and lang from source/context
      const isTib = name.startsWith("tib_") || s.defLang === "bo";
      const isPali = name === "pali-en.apple";
      const group = isTib ? "Tibetan" : isPali ? "P\u0101li" : "Sanskrit";
      const lang = isTib ? "bo" : isPali ? "pi" : "sa";
      return { label: s.label, group, lang,
               tier: s.tier, defLang: s.defLang, subgroup: s.subgroup,
               family: s.family || null, source: s.source || null };
    }
    if (name === "mahavyutpatti")
      return { label: "Mah\u0101vyutpatti (Skt\u2194Tib)", group: "Bilingual", lang: "sa-bo",
               tier: 1, defLang: "equiv", subgroup: "equiv", family: null, source: "bilex" };
    if (name === "apple_bod_rgya_tshig_mdzod")
      return { label: "Bod rgya tshig mdzod chen mo", group: "Tibetan", lang: "bo",
               tier: 1, defLang: "bo", subgroup: "native", family: null, source: "apple" };
    // Unknown dict fallback
    return { label: name, group: "Other", lang: "?",
             tier: 3, defLang: "mixed", subgroup: "domain", family: null, source: null };
  }

  window.DictNames = { label, DISPLAY_GROUPS, getDisplayGroupIndex };
})();
