interface DailySchedule {
  [key: string]: { start: string; end: string };
}

export const formatWorkSchedule = (
  workDays?: string[],
  dailySchedule?: DailySchedule,
  lunchBreak?: string,
  weeklyHours?: number
): string => {
  if (!workDays || workDays.length === 0) {
    return "Horário a combinar";
  }

  // Group days by schedule
  const scheduleGroups: { [key: string]: string[] } = {};
  
  workDays.forEach(day => {
    const schedule = dailySchedule?.[day];
    if (schedule) {
      const timeKey = `${schedule.start}-${schedule.end}`;
      if (!scheduleGroups[timeKey]) {
        scheduleGroups[timeKey] = [];
      }
      scheduleGroups[timeKey].push(day);
    }
  });

  // Smart grouping and formatting
  const formattedParts: string[] = [];
  
  Object.entries(scheduleGroups).forEach(([timeRange, days]) => {
    const [start, end] = timeRange.split('-');
    const timeFormatted = `${start}h às ${end}h`;
    
    // Check for common weekday pattern (Monday-Friday)
    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const weekdaysInGroup = days.filter(day => weekdays.includes(day));
    const weekend = days.filter(day => ['saturday', 'sunday'].includes(day));
    
    if (weekdaysInGroup.length === 5) {
      formattedParts.push(`Seg-Sex: ${timeFormatted}`);
    } else if (weekdaysInGroup.length > 0) {
      const dayNames = weekdaysInGroup.map(day => {
        const names: { [key: string]: string } = {
          'monday': 'Seg', 'tuesday': 'Ter', 'wednesday': 'Qua', 
          'thursday': 'Qui', 'friday': 'Sex'
        };
        return names[day];
      });
      formattedParts.push(`${dayNames.join('-')}: ${timeFormatted}`);
    }
    
    weekend.forEach(day => {
      const dayName = day === 'saturday' ? 'Sáb' : 'Dom';
      formattedParts.push(`${dayName}: ${timeFormatted}`);
    });
  });

  let result = formattedParts.join(' | ');
  
  if (lunchBreak) {
    result += ` | Almoço: ${lunchBreak}`;
  }

  return result || "Horário a combinar";
};

export const formatWorkDays = (workDays?: string[]): string => {
  if (!workDays || workDays.length === 0) {
    return "Não especificado";
  }

  const dayNames: { [key: string]: string } = {
    'monday': 'Segunda-feira',
    'tuesday': 'Terça-feira', 
    'wednesday': 'Quarta-feira',
    'thursday': 'Quinta-feira',
    'friday': 'Sexta-feira',
    'saturday': 'Sábado',
    'sunday': 'Domingo'
  };

  const translatedDays = workDays.map(day => dayNames[day] || day);
  
  if (translatedDays.length <= 2) {
    return translatedDays.join(' e ');
  }
  
  const lastDay = translatedDays.pop();
  return `${translatedDays.join(', ')} e ${lastDay}`;
};