  // Función simplificada para añadir roles recomendados al equipo
  const addRecommendedRoles = useCallback(() => {
    console.log("[NUEVA IMPLEMENTACIÓN] Añadiendo roles recomendados:", recommendedRoleIds);
    
    try {
      // Verificación básica
      if (!roles || !selectedTemplateId) {
        console.log("No hay roles disponibles o no se ha seleccionado plantilla");
        return;
      }
      
      // Verificar que tenemos roles recomendados
      if (!recommendedRoleIds || recommendedRoleIds.length === 0) {
        console.log("No hay roles recomendados que añadir");
        return;
      }
      
      // Obtener roles únicos
      const uniqueRoleIds = Array.from(new Set(recommendedRoleIds));
      console.log("Roles únicos a añadir:", uniqueRoleIds);
      
      // Crear array de nuevos miembros
      let newMembers: TeamMember[] = [];
      
      // Para cada rol recomendado, crear un miembro de equipo
      uniqueRoleIds.forEach(roleId => {
        const role = roles.find(r => r.id === roleId);
        if (role) {
          // Horas predeterminadas
          const hours = 40;
          
          newMembers.push({
            id: uuidv4(),
            roleId: role.id,
            personnelId: null,
            hours: hours,
            rate: role.defaultRate,
            cost: hours * role.defaultRate
          });
          
          console.log(`Añadido rol: ${role.name} con ${hours} horas y tarifa ${role.defaultRate}`);
        } else {
          console.log(`Rol con ID ${roleId} no encontrado`);
        }
      });
      
      // Si tenemos miembros para añadir
      if (newMembers.length > 0) {
        // Limpiar equipo actual
        setTeamMembers([]);
        // Luego añadir todos los nuevos miembros
        setTeamMembers(newMembers);
        console.log(`Añadidos ${newMembers.length} miembros al equipo`);
        
        // Recalcular costos
        calculateTotalCost();
      } else {
        console.log("No se pudieron añadir roles recomendados");
        
        // En caso de error, añadir al menos un rol
        if (roles.length > 0) {
          const defaultRole = roles[0];
          const hours = 40;
          
          const emergencyMember: TeamMember = {
            id: uuidv4(),
            roleId: defaultRole.id,
            personnelId: null,
            hours: hours,
            rate: defaultRole.defaultRate,
            cost: hours * defaultRole.defaultRate
          };
          
          setTeamMembers([emergencyMember]);
          console.log("Añadido rol de emergencia:", defaultRole.name);
          
          // Recalcular costos
          calculateTotalCost();
        }
      }
    } catch (error) {
      console.error("Error crítico al añadir roles:", error);
    }
  }, [recommendedRoleIds, roles, selectedTemplateId, calculateTotalCost]);