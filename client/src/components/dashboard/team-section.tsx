
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

interface TeamMember {
  id: number;
  name: string;
  role: string;
  hours: number;
}

interface TeamSectionProps {
  teamMembers: TeamMember[];
  onHelpClick: (helpType: string) => void;
}

export const TeamAvatar = ({ name, role, size = "md" }: { name: string, role?: string, size?: "sm" | "md" | "lg" }) => {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-base"
  };
  
  return (
    <div className="flex items-center gap-2">
      <div className={`${sizeClasses[size]} rounded-full bg-primary/10 text-primary flex items-center justify-center`}>
        {initials}
      </div>
      {role && (
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">{role}</div>
        </div>
      )}
    </div>
  );
};

export const TeamSection = ({ teamMembers, onHelpClick }: TeamSectionProps) => {
  return (
    <div className="mb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg font-medium">Equipo Asignado</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 h-6 w-6"
                  onClick={() => onHelpClick('teamHelp')}
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-8">
                  Ver Todos
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Lista de miembros del equipo */}
              <div>
                <div className="text-sm font-medium mb-3">Personal Asignado</div>
                <div className="space-y-3">
                  {teamMembers.slice(0, 5).map((person) => (
                    <div key={person.id} className="flex justify-between items-center">
                      <TeamAvatar name={person.name} role={person.role} />
                      <div className="text-sm font-medium">{person.hours}h</div>
                    </div>
                  ))}
                  
                  {teamMembers.length > 5 && (
                    <div className="text-center text-sm text-muted-foreground mt-2">
                      + {teamMembers.length - 5} personas más
                    </div>
                  )}
                  
                  {teamMembers.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-4">
                      No hay personal asignado en este periodo
                    </div>
                  )}
                </div>
              </div>
              
              {/* Distribución de horas por rol */}
              <div>
                <div className="text-sm font-medium mb-3">Distribución por Rol</div>
                {teamMembers.length > 0 ? (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={teamMembers}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="hours"
                          nameKey="role"
                        >
                          {teamMembers.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={[
                                "#4f46e5", "#10b981", "#f97316",
                                "#8b5cf6", "#ec4899", "#14b8a6"
                              ][index % 6]}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value} horas`, ""]} />
                        <Legend
                          formatter={(value) => <span style={{ fontSize: '12px' }}>{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center text-sm text-muted-foreground py-4">
                    No hay datos disponibles en este periodo
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default TeamSection;