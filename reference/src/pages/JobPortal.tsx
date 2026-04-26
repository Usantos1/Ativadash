import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useJobSurveys } from '@/hooks/useJobSurveys';

import {
  Building2,
  MapPin,
  Clock,
  DollarSign,
  Users,
  ExternalLink,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { JobSurvey } from '@/hooks/useJobSurveys';

const themeCSS = `
  :root {
    /* Claro */
    --job-bg: 220 20% 97%;
    --job-card: 0 0% 100%;
    --job-card-border: 220 13% 91%;
    --job-text: 222 47% 11%;
    --job-text-muted: 215 16% 47%;
    --job-primary: 358 75% 52%; /* vermelho PrimeCamp */
    --job-primary-hover: 358 75% 45%;
    --job-badge: 210 40% 96%;
    --job-gradient-start: 358 75% 52%;
    --job-gradient-end: 340 65% 47%;
  }
  .dark {
    /* Escuro */
    --job-bg: 222 22% 8%;
    --job-card: 220 15% 13%;
    --job-card-border: 220 13% 22%;
    --job-text: 210 40% 98%;
    --job-text-muted: 215 20% 65%;
    --job-primary: 358 82% 56%;
    --job-primary-hover: 358 82% 50%;
    --job-badge: 220 15% 18%;
    --job-gradient-start: 358 82% 56%;
    --job-gradient-end: 340 70% 50%;
  }
  
  html {
    overflow-x: hidden;
    overflow-y: auto !important;
    height: auto !important;
  }
  
  body {
    overflow-x: hidden;
    overflow-y: auto !important;
    height: auto !important;
    min-height: 100vh;
  }
  
  #root {
    height: auto !important;
    min-height: 100vh;
    overflow: visible !important;
  }
  
  .job-portal-scroll {
    min-height: 100vh;
    max-height: 100vh;
    height: 100vh;
    overflow-x: hidden;
    overflow-y: auto;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
  }
  
  /* Scrollbar fino e discreto */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  
  ::-webkit-scrollbar-thumb {
    background: hsl(var(--job-text-muted) / 0.3);
    border-radius: 3px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--job-text-muted) / 0.5);
  }
  
  /* Firefox */
  * {
    scrollbar-width: thin;
    scrollbar-color: hsl(var(--job-text-muted) / 0.3) transparent;
  }
  
  .job-card-hover {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .job-card-hover:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  }
  
  .gradient-text {
    background: linear-gradient(135deg, hsl(var(--job-gradient-start)), hsl(var(--job-gradient-end)));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .hero-pattern {
    background-image: radial-gradient(circle at 1px 1px, hsl(var(--job-text-muted) / 0.15) 1px, transparent 0);
    background-size: 40px 40px;
  }
`;

export default function JobPortal() {
  const [selectedJob, setSelectedJob] = useState<JobSurvey | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Filtros
  const [q, setQ] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => {
    const id = setTimeout(() => {
      setSearchTerm(q.trim());
      setCurrentPage(1); // Resetar página ao buscar
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const [locationFilter, setLocationFilter] = useState('all');
  const [modalityFilter, setModalityFilter] = useState('all');
  const [contractFilter, setContractFilter] = useState('all');
  const [salaryMinFilter, setSalaryMinFilter] = useState('');
  const [salaryMaxFilter, setSalaryMaxFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Construir filtros para o hook
  const filters = useMemo(() => {
    const f: any = {
      is_active: true,
    };

    if (searchTerm) {
      f.search = searchTerm;
    }

    if (locationFilter !== 'all') {
      f.location = locationFilter;
    }

    if (modalityFilter !== 'all') {
      f.modality = modalityFilter;
    }

    if (contractFilter !== 'all') {
      f.contract_type = contractFilter;
    }

    if (salaryMinFilter) {
      const min = parseFloat(salaryMinFilter);
      if (!isNaN(min)) f.salary_min = min;
    }

    if (salaryMaxFilter) {
      const max = parseFloat(salaryMaxFilter);
      if (!isNaN(max)) f.salary_max = max;
    }

    return f;
  }, [searchTerm, locationFilter, modalityFilter, contractFilter, salaryMinFilter, salaryMaxFilter]);

  // Usar o hook React Query
  const { surveys: jobs, total, totalPages, loading, refetch } = useJobSurveys({
    filters,
    page: currentPage,
    pageSize,
  });

  // Buscar todas as vagas para obter opções de filtros únicas
  const { surveys: allJobs } = useJobSurveys({
    filters: { is_active: true },
    page: 1,
    pageSize: 1000, // Buscar muitas para ter opções completas
  });

  const uniqueLocations = useMemo(
    () =>
      [
        ...new Set(
          allJobs
            .map((j) => (j.location || '').trim())
            .filter((l) => l !== '')
        ),
      ].sort() as string[],
    [allJobs]
  );

  const uniqueModalities = useMemo(
    () =>
      [
        ...new Set(
          allJobs
            .map((j) => (j.work_modality || '').trim())
            .filter((m) => m !== '')
        ),
      ].sort() as string[],
    [allJobs]
  );

  const uniqueContractTypes = useMemo(
    () =>
      [
        ...new Set(
          allJobs
            .map((j) => (j.contract_type || '').trim())
            .filter((c) => c !== '')
        ),
      ].sort() as string[],
    [allJobs]
  );

  const formatSalary = (job: JobSurvey) => {
    const fmt = (n: number) => n.toLocaleString('pt-BR');
    if (job.salary_range) return job.salary_range;
    if (job.salary_min && job.salary_max)
      return `R$ ${fmt(job.salary_min)} – R$ ${fmt(job.salary_max)}`;
    if (job.salary_min) return `A partir de R$ ${fmt(job.salary_min)}`;
    return 'Salário a combinar';
  };

  const handleApply = (job: JobSurvey) => {
    if (job.slug) window.open(`/vaga/${job.slug}`, '_blank');
    else window.open(`/job-application/${job.id}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--job-application))' }}>
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            {/* Header Skeleton */}
            <div className="text-center space-y-4">
              <Skeleton className="h-8 w-48 mx-auto" />
              <Skeleton className="h-6 w-64 mx-auto" />
            </div>

            {/* Filters Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>

            {/* Jobs Grid Skeleton */}
            <div className="grid gap-4 md:gap-6 md:grid-cols-2">
              {[...Array(6)].map((_, i) => (
                <Card
                  key={i}
                  className="rounded-2xl"
                  style={{
                    backgroundColor: 'hsl(var(--job-card))',
                    borderColor: 'hsl(var(--job-card-border))',
                  }}
                >
                  <CardContent className="p-4 md:p-5 space-y-4">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-9 flex-1" />
                      <Skeleton className="h-9 flex-1" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Vagas de Emprego - Prime Camp | Encontre Sua Oportunidade</title>
        <meta
          name="description"
          content="Encontre as melhores oportunidades de trabalho na Prime Camp. Vagas atualizadas em diversas áreas: tecnologia, vendas, marketing e mais. Candidatura rápida e fácil."
        />
        <meta
          name="keywords"
          content="vagas de emprego, trabalho, carreiras, Prime Camp, oportunidades, emprego, recrutamento, seleção"
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`${window.location.origin}/vagas`} />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Vagas de Emprego - Prime Camp" />
        <meta property="og:description" content="Encontre as melhores oportunidades de trabalho na Prime Camp. Vagas atualizadas em diversas áreas." />
        <meta property="og:url" content={`${window.location.origin}/vagas`} />
        <meta property="og:site_name" content="Prime Camp" />
        <meta property="og:image" content="https://api.ativacrm.com/public/logoBanner-1744208731220-626790695.png" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Vagas de Emprego - Prime Camp" />
        <meta name="twitter:description" content="Encontre as melhores oportunidades de trabalho na Prime Camp." />
        <meta name="twitter:image" content="https://api.ativacrm.com/public/logoBanner-1744208731220-626790695.png" />
        
        <style>{themeCSS}</style>
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Vagas de Emprego - Prime Camp',
            description: 'Lista de vagas de emprego disponíveis na Prime Camp',
            numberOfItems: total,
            itemListElement: jobs.slice(0, 10).map((j, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              item: {
                '@type': 'JobPosting',
                title: j.title,
                description: j.description || j.position_title,
                identifier: {
                  '@type': 'PropertyValue',
                  name: 'ID',
                  value: j.id
                },
                datePosted: j.created_at,
                validThrough: j.expires_at || undefined,
                employmentType: j.contract_type || 'FULL_TIME',
                hiringOrganization: {
                  '@type': 'Organization',
                  name: j.company_name || 'Prime Camp',
                  sameAs: window.location.origin
                },
                jobLocation: j.location ? {
                  '@type': 'Place',
                  address: {
                    '@type': 'PostalAddress',
                    addressLocality: j.location
                  }
                } : undefined,
                baseSalary: (j.salary_min || j.salary_max) ? {
                  '@type': 'MonetaryAmount',
                  currency: 'BRL',
                  value: {
                    '@type': 'QuantitativeValue',
                    minValue: j.salary_min,
                    maxValue: j.salary_max,
                    unitText: 'MONTH'
                  }
                } : undefined,
                workHours: j.weekly_hours ? `${j.weekly_hours} horas por semana` : undefined
              },
            })),
          })}
        </script>
      </Helmet>

      <div
        className="job-portal-scroll"
        style={{ backgroundColor: 'hsl(var(--job-bg))' }}
      >
        {/* Header com gradiente */}
        <header
          className="relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, hsl(var(--job-gradient-start)) 0%, hsl(var(--job-gradient-end)) 100%)`,
          }}
        >
          {/* Pattern overlay */}
          <div className="absolute inset-0 hero-pattern opacity-20" />
          
          <div className="relative mx-auto max-w-6xl px-4 py-10 sm:py-14 md:py-16 text-center">
            <div className="absolute top-4 right-4">
              <ThemeToggle variant="button" className="bg-white/20 hover:bg-white/30 text-white border-0" />
            </div>

            <div className="flex items-center justify-center gap-4 mb-4">
              <a href="/" aria-label="Home" className="bg-white rounded-xl p-3 shadow-lg hover:shadow-xl transition-shadow">
                <img
                  src="https://api.ativacrm.com/public/logoBanner-1744208731220-626790695.png"
                  alt="Prime Camp"
                  className="h-10 sm:h-12 md:h-14 w-auto object-contain"
                  loading="eager"
                  decoding="async"
                />
              </a>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white drop-shadow-md">
              Portal de Vagas
            </h1>
            <p className="max-w-2xl mx-auto mt-3 text-sm sm:text-base md:text-lg text-white/90">
              Encontre a oportunidade perfeita para sua carreira. Temos vagas
              em diversas áreas e modalidades de trabalho.
            </p>
            
            {/* Estatísticas */}
            <div className="flex items-center justify-center gap-6 sm:gap-10 mt-6">
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-white">{total}</div>
                <div className="text-xs sm:text-sm text-white/80">Vagas Ativas</div>
              </div>
              <div className="w-px h-10 bg-white/30" />
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-white">{uniqueLocations.length}</div>
                <div className="text-xs sm:text-sm text-white/80">Localizações</div>
              </div>
              <div className="w-px h-10 bg-white/30" />
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-white">{uniqueModalities.length}</div>
                <div className="text-xs sm:text-sm text-white/80">Modalidades</div>
              </div>
            </div>
          </div>
          
          {/* Curva decorativa */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-8 sm:h-12">
              <path d="M0 60V30C240 10 480 0 720 0C960 0 1200 10 1440 30V60H0Z" fill="hsl(var(--job-bg))" />
            </svg>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8 space-y-6">
          {/* Filtros */}
          <Card
            className="border shadow-sm rounded-2xl"
            style={{
              backgroundColor: 'hsl(var(--job-card))',
              borderColor: 'hsl(var(--job-card-border))',
            }}
          >
            <CardHeader className="pb-3 px-4 sm:px-6">
              <CardTitle
                className="flex items-center gap-2 text-base sm:text-lg md:text-xl"
                style={{ color: 'hsl(var(--job-text))' }}
              >
                <Search className="h-4 w-4 sm:h-5 sm:w-5" />
                Filtrar Vagas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {/* Buscar */}
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    style={{ color: 'hsl(var(--job-text))' }}
                  >
                    Buscar
                  </label>
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                      style={{ color: 'hsl(var(--job-text-muted))' }}
                    />
                    <Input
                      aria-label="Buscar vagas"
                      className="pl-9 h-10 bg-white dark:bg-neutral-900 border text-[hsl(var(--job-text))] placeholder:text-[hsl(var(--job-text-muted))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--job-primary))]"
                      style={{ borderColor: 'hsl(var(--job-card-border))' }}
                      placeholder="Cargo, empresa, palavra‑chave..."
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </div>
                </div>

                {/* Localização */}
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    style={{ color: 'hsl(var(--job-text))' }}
                  >
                    Localização
                  </label>
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger
                      aria-label="Filtrar por localização"
                      className="h-10 bg-white dark:bg-neutral-900 border text-[hsl(var(--job-text))] focus:ring-2 focus:ring-[hsl(var(--job-primary))]"
                      style={{ borderColor: 'hsl(var(--job-card-border))' }}
                    >
                      <SelectValue placeholder="Todas as localizações" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      <SelectItem value="all">Todas as localizações</SelectItem>
                      {uniqueLocations.map((location) => (
                        <SelectItem key={location} value={location || 'unknown'}>
                          {location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Modalidade + Limpar */}
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    style={{ color: 'hsl(var(--job-text))' }}
                  >
                    Modalidade
                  </label>
                  <div className="flex gap-2">
                    <Select value={modalityFilter} onValueChange={setModalityFilter}>
                      <SelectTrigger
                        aria-label="Filtrar por modalidade"
                        className="h-10 flex-1 bg-white dark:bg-neutral-900 border text-[hsl(var(--job-text))] focus:ring-2 focus:ring-[hsl(var(--job-primary))]"
                        style={{ borderColor: 'hsl(var(--job-card-border))' }}
                      >
                        <SelectValue placeholder="Todas as modalidades" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        <SelectItem value="all">Todas as modalidades</SelectItem>
                        {uniqueModalities.map((modality) => (
                          <SelectItem
                            key={modality}
                            value={modality || 'unknown'}
                          >
                            {modality.charAt(0).toUpperCase() + modality.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 whitespace-nowrap"
                      style={{
                        backgroundColor: 'hsl(var(--job-card))',
                        borderColor: 'hsl(var(--job-primary))',
                        color: 'hsl(var(--job-primary))',
                      }}
                      onClick={() => {
                        setQ('');
                        setSearchTerm('');
                        setLocationFilter('all');
                        setModalityFilter('all');
                      }}
                    >
                      Limpar
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contagem e Filtros Avançados */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <h2
              className="text-lg sm:text-xl md:text-2xl font-bold"
              style={{ color: 'hsl(var(--job-text))' }}
            >
              {total} {total === 1 ? 'vaga encontrada' : 'vagas encontradas'}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <Filter className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Filtros Avançados</span>
            </Button>
          </div>

          {/* Filtros Avançados */}
          {showAdvancedFilters && (
            <Card
              className="border shadow-sm rounded-2xl"
              style={{
                backgroundColor: 'hsl(var(--job-card))',
                borderColor: 'hsl(var(--job-card-border))',
              }}
            >
              <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium"
                      style={{ color: 'hsl(var(--job-text))' }}
                    >
                      Tipo de Contrato
                    </label>
                    <Select value={contractFilter} onValueChange={setContractFilter}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Todos os tipos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os tipos</SelectItem>
                        {uniqueContractTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium"
                      style={{ color: 'hsl(var(--job-text))' }}
                    >
                      Salário Mínimo (R$)
                    </label>
                    <Input
                      type="number"
                      placeholder="Ex: 3000"
                      value={salaryMinFilter}
                      onChange={(e) => {
                        setSalaryMinFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium"
                      style={{ color: 'hsl(var(--job-text))' }}
                    >
                      Salário Máximo (R$)
                    </label>
                    <Input
                      type="number"
                      placeholder="Ex: 10000"
                      value={salaryMaxFilter}
                      onChange={(e) => {
                        setSalaryMaxFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="h-10"
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setContractFilter('all');
                        setSalaryMinFilter('');
                        setSalaryMaxFilter('');
                        setCurrentPage(1);
                      }}
                      className="w-full h-10"
                    >
                      Limpar Filtros
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de vagas */}
          {jobs.length === 0 ? (
            <Card
              className="rounded-2xl"
              style={{
                backgroundColor: 'hsl(var(--job-card))',
                borderColor: 'hsl(var(--job-card-border))',
              }}
            >
              <CardContent className="py-12 text-center space-y-3">
                <Users
                  className="h-12 w-12 mx-auto mb-2"
                  style={{ color: 'hsl(var(--job-text-muted))' }}
                />
                <h3
                  className="text-lg font-semibold"
                  style={{ color: 'hsl(var(--job-text))' }}
                >
                  Nenhuma vaga encontrada
                </h3>
                <p style={{ color: 'hsl(var(--job-text-muted))' }}>
                  Tente ajustar seus filtros ou volte mais tarde.
                </p>
                <Button
                  variant="outline"
                  style={{
                    backgroundColor: 'hsl(var(--job-card))',
                    borderColor: 'hsl(var(--job-primary))',
                    color: 'hsl(var(--job-primary))',
                  }}
                  onClick={() => {
                    setQ('');
                    setSearchTerm('');
                    setLocationFilter('all');
                    setModalityFilter('all');
                  }}
                >
                  Limpar filtros
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
                {jobs.map((job) => (
                <Card
                  key={job.id}
                  className="job-card-hover rounded-2xl border overflow-hidden"
                  style={{
                    backgroundColor: 'hsl(var(--job-card))',
                    borderColor: 'hsl(var(--job-card-border))',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
                  }}
                >
                  {/* Barra colorida no topo */}
                  <div 
                    className="h-1"
                    style={{ background: `linear-gradient(90deg, hsl(var(--job-gradient-start)), hsl(var(--job-gradient-end)))` }}
                  />
                  
                  <CardContent className="p-4 sm:p-5 space-y-3 sm:space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <h3
                          className="text-base md:text-lg font-bold leading-tight line-clamp-2"
                          style={{ color: 'hsl(var(--job-text))' }}
                        >
                          {job.title}
                        </h3>
                        <Badge
                          className="text-white shrink-0 font-medium shadow-sm"
                          style={{ 
                            background: `linear-gradient(135deg, hsl(var(--job-gradient-start)), hsl(var(--job-gradient-end)))`,
                          }}
                        >
                          {job.work_modality?.charAt(0).toUpperCase() +
                            job.work_modality?.slice(1)}
                        </Badge>
                      </div>
                      <p
                        className="text-sm font-medium"
                        style={{ color: 'hsl(var(--job-text-muted))' }}
                      >
                        {job.position_title}
                      </p>
                    </div>

                    {job.description && (
                      <div className="space-y-2">
                        <p
                          className="text-sm line-clamp-2 md:line-clamp-3"
                          style={{ color: 'hsl(var(--job-text-muted))' }}
                        >
                          {job.description}
                        </p>
                        <Dialog
                          open={selectedJob?.id === job.id}
                          onOpenChange={(open) => setSelectedJob(open ? job : null)}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs"
                              style={{ color: 'hsl(var(--job-primary))' }}
                            >
                              ... ver mais
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{job.title}</DialogTitle>
                              <DialogDescription>
                                {job.position_title}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="flex flex-wrap gap-2">
                                {job.company_name && (
                                  <Badge
                                    variant="secondary"
                                    className="gap-1"
                                    style={{
                                      backgroundColor: 'hsl(var(--job-badge))',
                                      color: 'hsl(var(--job-text-muted))',
                                    }}
                                  >
                                    <Building2 className="h-3 w-3" />
                                    {job.company_name}
                                  </Badge>
                                )}
                                {job.location && (
                                  <Badge
                                    variant="secondary"
                                    className="gap-1"
                                    style={{
                                      backgroundColor: 'hsl(var(--job-badge))',
                                      color: 'hsl(var(--job-text-muted))',
                                    }}
                                  >
                                    <MapPin className="h-3 w-3" />
                                    {job.location}
                                  </Badge>
                                )}
                                <Badge
                                  variant="secondary"
                                  className="gap-1"
                                  style={{
                                    backgroundColor: 'hsl(var(--job-badge))',
                                    color: 'hsl(var(--job-text-muted))',
                                  }}
                                >
                                  <DollarSign className="h-3 w-3" />
                                  {formatSalary(job)}
                                </Badge>
                                {job.work_schedule && (
                                  <Badge
                                    variant="secondary"
                                    className="gap-1"
                                    style={{
                                      backgroundColor: 'hsl(var(--job-badge))',
                                      color: 'hsl(var(--job-text-muted))',
                                    }}
                                  >
                                    <Clock className="h-3 w-3" />
                                    {job.work_schedule}
                                  </Badge>
                                )}
                              </div>
                              <div className="prose prose-sm max-w-none">
                                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                  {job.description}
                                </p>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                                <Button
                                  variant="outline"
                                  className="flex-1"
                                  style={{
                                    backgroundColor: 'hsl(var(--job-card))',
                                    borderColor: 'hsl(var(--job-primary))',
                                    color: 'hsl(var(--job-primary))',
                                  }}
                                  onClick={() =>
                                    window.open(`/vaga/${job.slug || job.id}`, '_blank')
                                  }
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  Ver Formulário
                                </Button>
                                <Button
                                  className="flex-1"
                                  style={{
                                    backgroundColor: 'hsl(var(--job-primary))',
                                    color: 'white',
                                  }}
                                  onClick={() => handleApply(job)}
                                >
                                  <Users className="h-4 w-4 mr-1" />
                                  Candidatar-se
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {job.company_name && (
                        <Badge
                          variant="secondary"
                          className="gap-1 text-xs"
                          style={{
                            backgroundColor: 'hsl(var(--job-badge))',
                            color: 'hsl(var(--job-text-muted))',
                          }}
                        >
                          <Building2 className="h-3 w-3" />
                          {job.company_name}
                        </Badge>
                      )}
                      {job.location && (
                        <Badge
                          variant="secondary"
                          className="gap-1 text-xs"
                          style={{
                            backgroundColor: 'hsl(var(--job-badge))',
                            color: 'hsl(var(--job-text-muted))',
                          }}
                        >
                          <MapPin className="h-3 w-3" />
                          {job.location}
                        </Badge>
                      )}
                      <Badge
                        variant="secondary"
                        className="gap-1 text-xs"
                        style={{
                          backgroundColor: 'hsl(var(--job-badge))',
                          color: 'hsl(var(--job-text-muted))',
                        }}
                      >
                        <DollarSign className="h-3 w-3" />
                        {formatSalary(job)}
                      </Badge>
                      {job.work_schedule && (
                        <Badge
                          variant="secondary"
                          className="gap-1 text-xs"
                          style={{
                            backgroundColor: 'hsl(var(--job-badge))',
                            color: 'hsl(var(--job-text-muted))',
                          }}
                        >
                          <Clock className="h-3 w-3" />
                          {job.work_schedule}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t" style={{ borderColor: 'hsl(var(--job-card-border))' }}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 w-full text-xs sm:text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        style={{
                          backgroundColor: 'transparent',
                          borderColor: 'hsl(var(--job-card-border))',
                          color: 'hsl(var(--job-text))',
                        }}
                        onClick={() => setSelectedJob(job)}
                      >
                        <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5" />
                        <span className="hidden sm:inline">Ver detalhes</span>
                        <span className="sm:hidden">Detalhes</span>
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 w-full text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg transition-all"
                        style={{
                          background: `linear-gradient(135deg, hsl(var(--job-gradient-start)), hsl(var(--job-gradient-end)))`,
                          color: 'white',
                        }}
                        onClick={() => handleApply(job)}
                      >
                        <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5" />
                        Candidatar-se
                      </Button>
                    </div>

                    {job.benefits && Array.isArray(job.benefits) && job.benefits.length > 0 && (
                      <div className="space-y-2">
                        <p
                          className="text-xs font-medium"
                          style={{ color: 'hsl(var(--job-text))' }}
                        >
                          Benefícios:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {job.benefits.slice(0, 3).map((benefit: string, index: number) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="text-xs"
                              style={{
                                backgroundColor: 'hsl(var(--job-badge))',
                                color: 'hsl(var(--job-text-muted))',
                              }}
                            >
                              {benefit}
                            </Badge>
                          ))}
                          {job.benefits.length > 3 && (
                            <Badge
                              variant="secondary"
                              className="text-xs"
                              style={{
                                backgroundColor: 'hsl(var(--job-badge))',
                                color: 'hsl(var(--job-text-muted))',
                              }}
                            >
                              +{job.benefits.length - 3} mais
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          style={
                            currentPage === pageNum
                              ? {
                                  backgroundColor: 'hsl(var(--job-primary))',
                                  color: 'white',
                                }
                              : {}
                          }
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-2"
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="text-center text-sm mt-4" style={{ color: 'hsl(var(--job-text-muted))' }}>
                Página {currentPage} de {totalPages}
              </div>
            </>
          )}
        </main>

        {/* Footer */}
        <footer
          className="mt-12"
          style={{
            background: `linear-gradient(135deg, hsl(var(--job-gradient-start)) 0%, hsl(var(--job-gradient-end)) 100%)`,
          }}
        >
          <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10 text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="bg-white rounded-lg p-2 shadow-md">
                <img
                  src="https://api.ativacrm.com/public/logoBanner-1744208731220-626790695.png"
                  alt="Prime Camp"
                  className="h-6 sm:h-8 w-auto object-contain"
                />
              </div>
            </div>
            <p className="text-white/90 text-sm sm:text-base">
              © {new Date().getFullYear()} Prime Camp. Todas as vagas são
              atualizadas regularmente.
            </p>
            <p className="text-white/70 text-xs mt-2">
              Trabalhe conosco e faça parte do nosso time!
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
