import { useState } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  orderBy,
} from "firebase/firestore";
import "./index.css";

const tecnicas = [
  "Gastronomia",
  "Refrigeracion",
  "Electricidad",
  "Electronica",
  "Contabilidad",
  "Mercadeo",
  "Informatica",
];
const secciones = ["A", "B"];
const grados = ["4to", "5to", "6to"];
const premiumScheduleStartCode = 1000;
const premiumScheduleEndCode = 1015;
const premiumScheduleStartHour = 10;
const premiumScheduleStartMinute = 0;
const premiumScheduleStepMinutes = 10;

interface TicketData {
  nombreCompleto: string;
  tecnica: string;
  seccion: string;
  numeroLista: string;
  tipoTicket: string;
  grado: string;
  codigo: string;
  horaLlegada: string;
}

interface TicketResult {
  nombreCompleto: string;
  grado: string;
  tecnica: string;
  seccion: string;
  numeroLista: string;
  tipoTicket: string;
  codigo: string;
}

interface RegisteredTicket extends TicketResult {
  id: string;
  creado?: string;
  accesoAt?: string;
  horaLlegada?: string;
}

interface PremiumScheduleRow {
  id: string;
  codigo: string;
  horario: string;
  horaLlegada?: string;
  nombreCompleto: string;
  grado: string;
  tecnica: string;
  seccion: string;
  numeroLista: string;
  accesoAt?: string;
  codeNumber: number;
}

function App() {
  const [activeTab, setActiveTab] = useState<
    "registro" | "acceso" | "registros"
  >("registro");
  const [submitted, setSubmitted] = useState(false);
  const [registeredTicket, setRegisteredTicket] = useState<TicketResult | null>(
    null,
  );
  const [scannedCode, setScannedCode] = useState("");
  const [accessResult, setAccessResult] = useState<TicketResult | null>(null);
  const [accessWarning, setAccessWarning] = useState("");
  const [accessTime, setAccessTime] = useState<string | null>(null);
  const [tickets, setTickets] = useState<RegisteredTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState("");
  const [recordsQuery, setRecordsQuery] = useState("");
  const [showUnscannedOnly, setShowUnscannedOnly] = useState(false);
  const [showScannedOnly, setShowScannedOnly] = useState(false);
  const [membershipFilter, setMembershipFilter] = useState<
    "all" | "Normal" | "VIP" | "Premium"
  >("all");
  const [registroLocked, setRegistroLocked] = useState(true);
  const [unlockInput, setUnlockInput] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<TicketData>({
    nombreCompleto: "",
    tecnica: "",
    seccion: "",
    numeroLista: "",
    tipoTicket: "",
    grado: "",
    codigo: "",
    horaLlegada: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    const normalizeHourInput = (rawValue: string) => {
      const digits = rawValue.replace(/\D/g, "").slice(0, 4);
      if (digits.length <= 2) {
        return digits;
      }
      return `${digits.slice(0, 2)}:${digits.slice(2)}`;
    };
    const nextValue =
      name === "horaLlegada" ? normalizeHourInput(value) : value;
    setFormData((prev) => ({ ...prev, [name]: nextValue }));
  };

  const registroUnlockKey =
    import.meta.env.VITE_REGISTRO_CLAVE;

  const handleUnlockRegistro = () => {
    if (unlockInput.trim() === registroUnlockKey) {
      setRegistroLocked(false);
      setUnlockInput("");
      setUnlockError("");
      return;
    }
    setUnlockError("Clave incorrecta");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const codigoInput = formData.codigo
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      if (codigoInput.length !== 6) {
        setError("El codigo debe tener 6 caracteres (XX-0000)");
        setLoading(false);
        return;
      }
      const prefix = codigoInput.slice(0, 2);
      let tipoTicket = "Normal";
      if (prefix.startsWith("VP")) {
        tipoTicket = "VIP";
      } else if (prefix.startsWith("PM")) {
        tipoTicket = "Premium";
      } else if (!prefix.startsWith("NM")) {
        setError("El codigo debe iniciar con NM, VP o PM");
        setLoading(false);
        return;
      }
      if (
        prefix.startsWith("PM") &&
        (!formData.horaLlegada.trim() ||
          !isValidHourMinute(formData.horaLlegada.trim()))
      ) {
        setError("Ingresa una hora valida (HH:MM) para Premium");
        setLoading(false);
        return;
      }
      const formattedCode = `${prefix}-${codigoInput.slice(2)}`;

      const checkQuery = query(
        collection(db, "tickets"),
        where("codigo", "==", formattedCode),
      );
      const checkSnapshot = await getDocs(checkQuery);
      if (!checkSnapshot.empty) {
        setError("Este ticket ya esta registrado");
        setLoading(false);
        return;
      }

      const ticketData = {
        ...formData,
        codigo: formattedCode,
        tipoTicket,
        creado: new Date().toISOString(),
      };
      await addDoc(collection(db, "tickets"), ticketData);
      console.log("Ticket registrado:", ticketData);
      setRegisteredTicket(ticketData as TicketResult);
      setSubmitted(true);
    } catch (err) {
      console.error("Error al registrar:", err);
      setError("Error al registrar el ticket");
    }
    setLoading(false);
  };

  const handleNewRegistration = () => {
    setFormData({
      nombreCompleto: "",
      tecnica: "",
      seccion: "",
      numeroLista: "",
      tipoTicket: "",
      grado: "",
      codigo: "",
      horaLlegada: "",
    });
    setSubmitted(false);
    setRegisteredTicket(null);
  };

  const formatAccessTime = (isoTime: string) => {
    const parsed = new Date(isoTime);
    if (Number.isNaN(parsed.getTime())) {
      return isoTime;
    }
    return parsed.toLocaleString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatHourMinute = (timeValue?: string) => {
    if (!timeValue) {
      return "";
    }
    return timeValue.slice(0, 5);
  };

  const isValidHourMinute = (timeValue: string) => {
    const match = timeValue.match(/^(\d{2}):(\d{2})$/);
    if (!match) {
      return false;
    }
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
  };

  const parsePremiumCodeNumber = (code: string) => {
    const match = code.match(/^PM-(\d{4})$/);
    return match ? Number(match[1]) : null;
  };

  const formatTime = (hour: number, minute: number) => {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  const getPremiumArrivalTime = (codeNumber: number) => {
    if (
      codeNumber < premiumScheduleStartCode ||
      codeNumber > premiumScheduleEndCode
    ) {
      return null;
    }
    const offset =
      (codeNumber - premiumScheduleStartCode) * premiumScheduleStepMinutes;
    const totalMinutes =
      premiumScheduleStartHour * 60 + premiumScheduleStartMinute + offset;
    const hour = Math.floor(totalMinutes / 60) % 24;
    const minute = totalMinutes % 60;
    return formatTime(hour, minute);
  };

  const escapeCsvValue = (value: string) => {
    const safe = value.replace(/"/g, '""');
    return `"${safe}"`;
  };

  const downloadPremiumCsv = () => {
    if (premiumScheduleRows.length === 0) {
      return;
    }
    const header = [
      "Horario",
      "Hora llegada",
      "Codigo",
      "Nombre",
      "Grado y tecnica",
      "Seccion",
      "Lista",
      "Escaneado",
    ];
    const rows = premiumScheduleRows.map((row) => {
      const values = [
        row.horario,
        row.horaLlegada || "",
        row.codigo,
        row.nombreCompleto,
        `${row.grado} - ${row.tecnica}`,
        `Seccion ${row.seccion}`,
        `#${row.numeroLista}`,
        row.accesoAt ? "Si" : "No",
      ];
      return values.map((value) => escapeCsvValue(String(value))).join(",");
    });
    const csvContent = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `premium_horarios_${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const loadRegisteredTickets = async () => {
    setTicketsLoading(true);
    setTicketsError("");
    try {
      const q = query(collection(db, "tickets"), orderBy("creado", "desc"));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Partial<RegisteredTicket>;
        return {
          id: docSnap.id,
          nombreCompleto: data.nombreCompleto || "",
          grado: data.grado || "",
          tecnica: data.tecnica || "",
          seccion: data.seccion || "",
          numeroLista: data.numeroLista || "",
          tipoTicket: data.tipoTicket || "",
          codigo: data.codigo || "",
          creado: data.creado,
          accesoAt: data.accesoAt,
          horaLlegada: data.horaLlegada,
        };
      });
      setTickets(items);
    } catch (err) {
      console.error("Error al cargar registros:", err);
      setTicketsError("Error al cargar los registros");
    }
    setTicketsLoading(false);
  };

  const handleAccessCheck = async () => {
    if (!scannedCode.trim()) {
      setError("Ingresa un codigo valido");
      return;
    }
    setScanning(true);
    setError("");
    setAccessResult(null);
    setAccessWarning("");
    setAccessTime(null);
    try {
      const searchCode = scannedCode.trim().toUpperCase();
      const q = query(
        collection(db, "tickets"),
        where("codigo", "==", searchCode),
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const doc = docSnap.data();
        const previousAccess =
          typeof doc.accesoAt === "string" ? doc.accesoAt : null;
        if (previousAccess) {
          setAccessWarning("Este ticket ya fue escaneado anteriormente.");
          setAccessTime(previousAccess);
        } else {
          await updateDoc(docSnap.ref, {
            accesoAt: new Date().toISOString(),
          });
        }
        setAccessResult({
          nombreCompleto: doc.nombreCompleto,
          grado: doc.grado,
          tecnica: doc.tecnica,
          seccion: doc.seccion,
          numeroLista: doc.numeroLista,
          tipoTicket: doc.tipoTicket,
          codigo: doc.codigo,
        });
      } else {
        setAccessResult(null);
        setError("Ticket no encontrado");
      }
    } catch (err) {
      console.error("Error al buscar:", err);
      setError("Error al consultar el ticket");
    }
    setScanning(false);
  };

  const resetScanner = () => {
    setScannedCode("");
    setAccessResult(null);
    setError("");
    setAccessWarning("");
    setAccessTime(null);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  const formatTicketCode = (rawValue: string) => {
    const cleaned = rawValue.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length <= 2) {
      return cleaned;
    }
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}`;
  };

  const normalizedQuery = recordsQuery.trim().toUpperCase();
  const premiumCodeInput = formData.codigo
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const isPremiumCode = premiumCodeInput.startsWith("PM");
  const searchedTickets = normalizedQuery
    ? tickets.filter((ticket) =>
        ticket.codigo.toUpperCase().includes(normalizedQuery),
      )
    : tickets;
  const unscannedFilteredTickets = showUnscannedOnly
    ? searchedTickets.filter((ticket) => !ticket.accesoAt)
    : searchedTickets;
  const scannedFilteredTickets = showScannedOnly
    ? unscannedFilteredTickets.filter((ticket) => ticket.accesoAt)
    : unscannedFilteredTickets;
  const membershipCounts = scannedFilteredTickets.reduce(
    (acc, ticket) => {
      acc.all += 1;
      if (ticket.tipoTicket === "VIP") {
        acc.VIP += 1;
      } else if (ticket.tipoTicket === "Premium") {
        acc.Premium += 1;
      } else {
        acc.Normal += 1;
      }
      return acc;
    },
    { all: 0, Normal: 0, VIP: 0, Premium: 0 },
  );
  const filteredTickets =
    membershipFilter === "all"
      ? scannedFilteredTickets
      : scannedFilteredTickets.filter(
          (ticket) => ticket.tipoTicket === membershipFilter,
        );
  const premiumScheduleRows = filteredTickets
    .filter((ticket) => ticket.codigo.startsWith("PM-"))
    .map((ticket) => {
      const codeNumber = parsePremiumCodeNumber(ticket.codigo);
      if (codeNumber === null) {
        return null;
      }
      const horario = getPremiumArrivalTime(codeNumber);
      if (!horario) {
        return null;
      }
      const row: PremiumScheduleRow = {
        id: ticket.id,
        codigo: ticket.codigo,
        horario,
        horaLlegada: ticket.horaLlegada
          ? formatHourMinute(ticket.horaLlegada)
          : undefined,
        nombreCompleto: ticket.nombreCompleto,
        grado: ticket.grado,
        tecnica: ticket.tecnica,
        seccion: ticket.seccion,
        numeroLista: ticket.numeroLista,
        accesoAt: ticket.accesoAt,
        codeNumber,
      };
      return row;
    })
    .filter((row): row is PremiumScheduleRow => row !== null)
    .sort((a, b) => a.codeNumber - b.codeNumber);

  return (
    <div className="app">
      <div className="header">
        <h1>Aureon Tickets</h1>
        <p>Registro y Acceso</p>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === "registro" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("registro");
            setError("");
          }}
        >
          Registro
        </button>
        <button
          className={`tab ${activeTab === "acceso" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("acceso");
            setTicketsError("");
          }}
        >
          Acceso
        </button>
        <button
          className={`tab ${activeTab === "registros" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("registros");
            setError("");
            loadRegisteredTickets();
          }}
        >
          Registros
        </button>
      </div>

      {activeTab === "registro" ? (
        submitted && registeredTicket ? (
          <div className="form-container">
            <div className="success-message">
              <div className="success-icon success">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h2>Ticket Registrado</h2>
              <p>Guarda tu codigo de acceso</p>

              <div className="code-display">
                <span className="code-label">Codigo</span>
                <span className="code-value">{registeredTicket.codigo}</span>
                <button
                  className="copy-btn"
                  onClick={() => copyCode(registeredTicket.codigo)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="16"
                    height="16"
                  >
                    <rect
                      x="9"
                      y="9"
                      width="13"
                      height="13"
                      rx="2"
                      ry="2"
                    ></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  Copiar
                </button>
              </div>

              <div className="ticket-details">
                <div className="detail-row">
                  <span>{registeredTicket.nombreCompleto}</span>
                </div>
                <div className="detail-row secondary">
                  <span>
                    {registeredTicket.grado} - {registeredTicket.tecnica} -
                    Seccion {registeredTicket.seccion}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="ticket-type-badge">
                    {registeredTicket.tipoTicket}
                  </span>
                </div>
              </div>

              <button onClick={handleNewRegistration} className="new-btn">
                Registrar Nuevo Ticket
              </button>
            </div>
          </div>
        ) : (
          <form
            className="form-container registration-container"
            onSubmit={handleSubmit}
          >
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label>Nombre Completo</label>
              <input
                type="text"
                name="nombreCompleto"
                value={formData.nombreCompleto}
                onChange={handleInputChange}
                placeholder="Ingresa tu nombre completo"
                required
              />
            </div>

            <div className="form-row-3">
              <div className="form-group">
                <label>Grado</label>
                <select
                  name="grado"
                  value={formData.grado}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Seleccionar</option>
                  {grados.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Tecnica</label>
                <select
                  name="tecnica"
                  value={formData.tecnica}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Seleccionar</option>
                  {tecnicas.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Seccion</label>
                <select
                  name="seccion"
                  value={formData.seccion}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">A/B</option>
                  {secciones.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Numero de Lista</label>
              <input
                type="number"
                name="numeroLista"
                value={formData.numeroLista}
                onChange={handleInputChange}
                placeholder="00"
                min="1"
                max="40"
                required
              />
            </div>

            <div className="form-group">
              <label>Codigo de Ticket</label>
              <input
                type="text"
                name="codigo"
                value={formData.codigo}
                onChange={handleInputChange}
                placeholder="XX-0000"
                maxLength={7}
                required
              />
            </div>

            {isPremiumCode && (
              <div className="form-group">
                <label>Hora de llegada (Premium)</label>
                <input
                  type="text"
                  name="horaLlegada"
                  value={formData.horaLlegada}
                  onChange={handleInputChange}
                  placeholder="HH:MM"
                  inputMode="numeric"
                  maxLength={5}
                  autoComplete="off"
                  required
                />
              </div>
            )}

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? "Registrando..." : "Registrar Ticket"}
            </button>

            {registroLocked && (
              <div className="locked-overlay">
                <div className="locked-card">
                  <div className="lock-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="4" y="10" width="16" height="10" rx="2" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    </svg>
                  </div>
                  <h3>Registro bloqueado</h3>
                  <p>Ingresa la clave para desbloquear</p>
                  <input
                    type="password"
                    value={unlockInput}
                    onChange={(e) => setUnlockInput(e.target.value)}
                    placeholder="Clave"
                    className="unlock-input"
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleUnlockRegistro()
                    }
                  />
                  {unlockError && (
                    <div className="unlock-error">{unlockError}</div>
                  )}
                  <button
                    type="button"
                    className="unlock-btn"
                    onClick={handleUnlockRegistro}
                  >
                    Desbloquear
                  </button>
                </div>
              </div>
            )}
          </form>
        )
      ) : activeTab === "acceso" ? (
        <div className="form-container">
          {error && <div className="error-message">{error}</div>}

          {!accessResult ? (
            <div className="scanner-container">
              <div className="scanner-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="7" y1="8" x2="17" y2="8"></line>
                  <line x1="7" y1="12" x2="17" y2="12"></line>
                  <line x1="7" y1="16" x2="13" y2="16"></line>
                </svg>
              </div>
              <h2>Control de Acceso</h2>
              <p>Ingresa o escanea el codigo del ticket</p>

              <div className="form-group">
                <input
                  type="text"
                  value={scannedCode}
                  onChange={(e) =>
                    setScannedCode(formatTicketCode(e.target.value))
                  }
                  placeholder="XX-0000"
                  className="code-input"
                  onKeyDown={(e) => e.key === "Enter" && handleAccessCheck()}
                />
              </div>

              <button
                className="scan-btn"
                onClick={handleAccessCheck}
                disabled={scanning}
              >
                {scanning ? "Consultando..." : "Verificar Acceso"}
              </button>
            </div>
          ) : (
            <div className="result-container access-granted">
              <div className="access-header">
                <div className="check-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <h3>Acceso Concedido</h3>
              </div>

              {accessWarning && accessTime && (
                <div className="warning-message">
                  <strong>Advertencia:</strong> {accessWarning} Horario:{" "}
                  {formatAccessTime(accessTime)}
                </div>
              )}

              <div className="visitor-info">
                <div className="info-row">
                  <span className="info-label">Nombre</span>
                  <span className="info-value">
                    {accessResult.nombreCompleto}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">Grado</span>
                  <span className="info-value">{accessResult.grado}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Tecnica</span>
                  <span className="info-value">{accessResult.tecnica}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Seccion</span>
                  <span className="info-value">{accessResult.seccion}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Lista</span>
                  <span className="info-value">
                    #{accessResult.numeroLista}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">Tipo</span>
                  <span className="info-value ticket-type-badge">
                    {accessResult.tipoTicket}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">Codigo</span>
                  <span className="info-value code-small">
                    {accessResult.codigo}
                  </span>
                </div>
              </div>

              <button className="access-btn" onClick={resetScanner}>
                Escanear Otro Ticket
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="form-container">
          <div className="records-header">
            <div>
              <h2>Registros</h2>
              <p className="records-subtitle">
                Tickets registrados con todos sus datos
              </p>
            </div>
            <button
              className="refresh-btn"
              onClick={loadRegisteredTickets}
              disabled={ticketsLoading}
            >
              {ticketsLoading ? "Cargando..." : "Actualizar"}
            </button>
          </div>

          <div className="records-search">
            <input
              type="text"
              value={recordsQuery}
              onChange={(e) => setRecordsQuery(e.target.value.toUpperCase())}
              placeholder="Buscar por codigo"
              className="search-input"
            />
          </div>

          <div className="records-filters">
            <button
              className={`toggle-btn ${showUnscannedOnly ? "active" : ""}`}
              onClick={() => {
                setShowUnscannedOnly((prev) => !prev);
                if (!showUnscannedOnly) setShowScannedOnly(false);
              }}
              type="button"
            >
              {showUnscannedOnly
                ? "Mostrando no escaneados"
                : "Ver no escaneados"}
            </button>
            <button
              className={`toggle-btn ${showScannedOnly ? "active" : ""}`}
              onClick={() => {
                setShowScannedOnly((prev) => !prev);
                if (!showScannedOnly) setShowUnscannedOnly(false);
              }}
              type="button"
            >
              {showScannedOnly ? "Mostrando escaneados" : "Ver escaneados"}
            </button>
            <span className="records-count">
              Mostrando {filteredTickets.length} de{" "}
              {scannedFilteredTickets.length}
            </span>
          </div>

          <div className="membership-filters">
            <span className="filter-label">Membresia</span>
            <div className="filter-chip-group">
              <button
                type="button"
                className={`filter-chip ${membershipFilter === "all" ? "active" : ""}`}
                onClick={() => setMembershipFilter("all")}
              >
                Todas <span className="chip-count">{membershipCounts.all}</span>
              </button>
              <button
                type="button"
                className={`filter-chip ${membershipFilter === "Normal" ? "active" : ""}`}
                onClick={() => setMembershipFilter("Normal")}
              >
                Normal{" "}
                <span className="chip-count">{membershipCounts.Normal}</span>
              </button>
              <button
                type="button"
                className={`filter-chip ${membershipFilter === "VIP" ? "active" : ""}`}
                onClick={() => setMembershipFilter("VIP")}
              >
                VIP <span className="chip-count">{membershipCounts.VIP}</span>
              </button>
              <button
                type="button"
                className={`filter-chip ${membershipFilter === "Premium" ? "active" : ""}`}
                onClick={() => setMembershipFilter("Premium")}
              >
                Premium{" "}
                <span className="chip-count">{membershipCounts.Premium}</span>
              </button>
            </div>
          </div>

          {ticketsError && <div className="error-message">{ticketsError}</div>}

          {ticketsLoading ? (
            <div className="empty-state">Cargando registros...</div>
          ) : filteredTickets.length === 0 ? (
            <div className="empty-state">
              {normalizedQuery
                ? "Sin resultados para ese codigo."
                : "No hay tickets registrados."}
            </div>
          ) : (
            <div className="tickets-list">
              {filteredTickets.map((ticket) => (
                <div className="ticket-card" key={ticket.id}>
                  <div className="ticket-card-header">
                    <span className="ticket-card-name">
                      {ticket.nombreCompleto}
                    </span>
                    <span className="ticket-type-badge">
                      {ticket.tipoTicket}
                    </span>
                  </div>
                  <div className="ticket-meta">
                    {ticket.grado} - {ticket.tecnica} - Seccion {ticket.seccion}
                  </div>
                  <div className="ticket-meta">Lista #{ticket.numeroLista}</div>
                  <div className="ticket-meta">Codigo: {ticket.codigo}</div>
                  {ticket.tipoTicket === "Premium" && ticket.horaLlegada && (
                    <div className="ticket-meta">
                      Hora llegada: {formatHourMinute(ticket.horaLlegada)}
                    </div>
                  )}
                  <div className="ticket-meta">
                    Registrado:{" "}
                    {ticket.creado
                      ? formatAccessTime(ticket.creado)
                      : "Sin dato"}
                  </div>
                  <div className="ticket-meta">
                    Acceso:{" "}
                    {ticket.accesoAt
                      ? formatAccessTime(ticket.accesoAt)
                      : "No escaneado"}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="premium-section">
            <div className="records-header">
              <div>
                <h2>Horarios Premium</h2>
                <p className="records-subtitle">
                  PM-1000 a PM-1015, cada 10 minutos
                </p>
              </div>
              <button
                className="export-btn"
                type="button"
                onClick={downloadPremiumCsv}
                disabled={premiumScheduleRows.length === 0}
              >
                Exportar a Excel
              </button>
            </div>

            {ticketsLoading ? (
              <div className="empty-state">Cargando horarios...</div>
            ) : premiumScheduleRows.length === 0 ? (
              <div className="empty-state">
                No hay premiums en el rango configurado.
              </div>
            ) : (
              <div className="premium-table-wrapper">
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Horario</th>
                      <th>Hora llegada</th>
                      <th>Codigo</th>
                      <th>Nombre</th>
                      <th>Grado y tecnica</th>
                      <th>Seccion</th>
                      <th>Lista</th>
                      <th>Escaneado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {premiumScheduleRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.horario}</td>
                        <td>{row.horaLlegada || "-"}</td>
                        <td>{row.codigo}</td>
                        <td>{row.nombreCompleto}</td>
                        <td>
                          {row.grado} - {row.tecnica}
                        </td>
                        <td>Seccion {row.seccion}</td>
                        <td>#{row.numeroLista}</td>
                        <td>{row.accesoAt ? "Si" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
