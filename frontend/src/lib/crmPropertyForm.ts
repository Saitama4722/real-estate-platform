/** CRM property form: типы и сбор JSON для API (источник истины — backend). */

export const CRM_PROPERTY_TYPE_VALUES = [
  "apartment",
  "house",
  "land",
  "commercial",
] as const;

export type CrmPropertyTypeValue = (typeof CRM_PROPERTY_TYPE_VALUES)[number];

export const CRM_PROPERTY_TYPE_LABELS: Record<CrmPropertyTypeValue, string> = {
  apartment: "Квартира",
  house: "Дом",
  land: "Участок",
  commercial: "Коммерция",
};

export type ChoiceItem = { value: string; label: string };

export type LocationsChoicesResponse = Record<string, ChoiceItem[]>;

export type CityRow = { id: number; name: string; slug: string };
export type DistrictRow = { id: number; name: string; slug: string; city: number };
export type NeighborhoodRow = {
  id: number;
  name: string;
  slug: string;
  city: number;
  district: number | null;
};
export type ResidentialComplexRow = {
  id: number;
  name: string;
  slug: string;
  city: number;
  district: number | null;
};

export interface ApartmentDetailsForm {
  rooms: string;
  area_total: string;
  area_living: string;
  area_kitchen: string;
  floor: string;
  floors_total: string;
  has_balcony: boolean;
  has_loggia: boolean;
  renovation_type: string;
  bathroom_type: string;
}

export interface HouseDetailsForm {
  house_area: string;
  land_area: string;
  floors_total: string;
  heating_type: string;
  has_gas: boolean;
  has_water: boolean;
  has_sewerage: boolean;
  has_electricity: boolean;
  building_type: string;
}

export interface LandDetailsForm {
  land_area: string;
  land_category: string;
  permitted_use: string;
  has_gas: boolean;
  has_water: boolean;
  has_electricity: boolean;
}

export interface CommercialDetailsForm {
  commercial_type: string;
  area_total: string;
  floor: string;
  floors_total: string;
  entrance_type: string;
  parking_spaces: string;
}

export function emptyApartmentDetails(): ApartmentDetailsForm {
  return {
    rooms: "",
    area_total: "",
    area_living: "",
    area_kitchen: "",
    floor: "",
    floors_total: "",
    has_balcony: false,
    has_loggia: false,
    renovation_type: "",
    bathroom_type: "",
  };
}

export function emptyHouseDetails(): HouseDetailsForm {
  return {
    house_area: "",
    land_area: "",
    floors_total: "",
    heating_type: "",
    has_gas: false,
    has_water: false,
    has_sewerage: false,
    has_electricity: false,
    building_type: "",
  };
}

export function emptyLandDetails(): LandDetailsForm {
  return {
    land_area: "",
    land_category: "",
    permitted_use: "",
    has_gas: false,
    has_water: false,
    has_electricity: false,
  };
}

export function emptyCommercialDetails(): CommercialDetailsForm {
  return {
    commercial_type: "",
    area_total: "",
    floor: "",
    floors_total: "",
    entrance_type: "",
    parking_spaces: "",
  };
}

function numOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

function decimalOrNull(s: string): string | null {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  return t;
}

/** Вложенный объект характеристик для POST/PATCH (как ожидает CrmPropertyWriteSerializer). */
export function buildDetailsPayload(
  propertyType: CrmPropertyTypeValue,
  apt: ApartmentDetailsForm,
  house: HouseDetailsForm,
  land: LandDetailsForm,
  comm: CommercialDetailsForm,
): Record<string, unknown> {
  if (propertyType === "apartment") {
    return {
      apartment_details: {
        rooms: numOrNull(apt.rooms),
        area_total: decimalOrNull(apt.area_total),
        area_living: decimalOrNull(apt.area_living),
        area_kitchen: decimalOrNull(apt.area_kitchen),
        floor: numOrNull(apt.floor),
        floors_total: numOrNull(apt.floors_total),
        has_balcony: apt.has_balcony,
        has_loggia: apt.has_loggia,
        renovation_type: apt.renovation_type || null,
        bathroom_type: apt.bathroom_type || null,
      },
    };
  }
  if (propertyType === "house") {
    return {
      house_details: {
        house_area: decimalOrNull(house.house_area),
        land_area: decimalOrNull(house.land_area),
        floors_total: numOrNull(house.floors_total),
        heating_type: house.heating_type || null,
        has_gas: house.has_gas,
        has_water: house.has_water,
        has_sewerage: house.has_sewerage,
        has_electricity: house.has_electricity,
        building_type: house.building_type || null,
      },
    };
  }
  if (propertyType === "land") {
    return {
      land_plot_details: {
        land_area: decimalOrNull(land.land_area),
        land_category: land.land_category || null,
        permitted_use: land.permitted_use || null,
        has_gas: land.has_gas,
        has_water: land.has_water,
        has_electricity: land.has_electricity,
      },
    };
  }
  return {
    commercial_details: {
      commercial_type: comm.commercial_type || null,
      area_total: decimalOrNull(comm.area_total),
      floor: numOrNull(comm.floor),
      floors_total: numOrNull(comm.floors_total),
      entrance_type: comm.entrance_type.trim() || null,
      parking_spaces: numOrNull(comm.parking_spaces),
    },
  };
}


export function validateDetailsForSubmit(
  propertyType: CrmPropertyTypeValue,
  apt: ApartmentDetailsForm,
  house: HouseDetailsForm,
  land: LandDetailsForm,
  comm: CommercialDetailsForm,
): string | null {
  if (propertyType === "apartment") {
    if (!apt.rooms.trim() || !apt.area_total.trim() || !apt.floor.trim() || !apt.floors_total.trim()) {
      return "Для квартиры укажите комнаты, общую площадь, этаж и этажность дома.";
    }
  } else if (propertyType === "house") {
    if (!house.house_area.trim() || !house.land_area.trim() || !house.floors_total.trim()) {
      return "Для дома укажите площадь дома, участок и количество этажей.";
    }
  } else if (propertyType === "land") {
    if (!land.land_area.trim()) {
      return "Для участка укажите площадь.";
    }
  } else if (propertyType === "commercial") {
    if (!comm.area_total.trim()) {
      return "Для коммерции укажите площадь.";
    }
  }
  return null;
}

/** Дубли: плоские поля как в DuplicateCheckSerializer */
export function buildDuplicateCheckExtras(
  propertyType: CrmPropertyTypeValue,
  apt: ApartmentDetailsForm,
  house: HouseDetailsForm,
  land: LandDetailsForm,
  comm: CommercialDetailsForm,
): Record<string, unknown> {
  const base: Record<string, unknown> = {};
  if (propertyType === "apartment") {
    base.rooms = numOrNull(apt.rooms);
    base.area_total = decimalOrNull(apt.area_total);
    base.floor = numOrNull(apt.floor);
    base.floors_total = numOrNull(apt.floors_total);
  } else if (propertyType === "house") {
    base.house_area = decimalOrNull(house.house_area);
    base.land_area = decimalOrNull(house.land_area);
  } else if (propertyType === "land") {
    base.land_area = decimalOrNull(land.land_area);
  } else if (propertyType === "commercial") {
    base.commercial_type = comm.commercial_type || null;
    base.area_total = decimalOrNull(comm.area_total);
  }
  return base;
}

export function parseDetailFromApi(
  propertyType: CrmPropertyTypeValue,
  row: Record<string, unknown>,
): {
  apt: ApartmentDetailsForm;
  house: HouseDetailsForm;
  land: LandDetailsForm;
  comm: CommercialDetailsForm;
} {
  const apt = emptyApartmentDetails();
  const house = emptyHouseDetails();
  const land = emptyLandDetails();
  const comm = emptyCommercialDetails();

  if (propertyType === "apartment") {
    const d = row.apartment_details as Record<string, unknown> | null | undefined;
    if (d && typeof d === "object") {
      apt.rooms = d.rooms != null ? String(d.rooms) : "";
      apt.area_total = d.area_total != null ? String(d.area_total) : "";
      apt.area_living = d.area_living != null ? String(d.area_living) : "";
      apt.area_kitchen = d.area_kitchen != null ? String(d.area_kitchen) : "";
      apt.floor = d.floor != null ? String(d.floor) : "";
      apt.floors_total = d.floors_total != null ? String(d.floors_total) : "";
      apt.has_balcony = Boolean(d.has_balcony);
      apt.has_loggia = Boolean(d.has_loggia);
      apt.renovation_type = typeof d.renovation_type === "string" ? d.renovation_type : "";
      apt.bathroom_type = typeof d.bathroom_type === "string" ? d.bathroom_type : "";
    }
  } else if (propertyType === "house") {
    const d = row.house_details as Record<string, unknown> | null | undefined;
    if (d && typeof d === "object") {
      house.house_area = d.house_area != null ? String(d.house_area) : "";
      house.land_area = d.land_area != null ? String(d.land_area) : "";
      house.floors_total = d.floors_total != null ? String(d.floors_total) : "";
      house.heating_type = typeof d.heating_type === "string" ? d.heating_type : "";
      house.has_gas = Boolean(d.has_gas);
      house.has_water = Boolean(d.has_water);
      house.has_sewerage = Boolean(d.has_sewerage);
      house.has_electricity = Boolean(d.has_electricity);
      house.building_type = typeof d.building_type === "string" ? d.building_type : "";
    }
  } else if (propertyType === "land") {
    const d = row.land_plot_details as Record<string, unknown> | null | undefined;
    if (d && typeof d === "object") {
      land.land_area = d.land_area != null ? String(d.land_area) : "";
      land.land_category = typeof d.land_category === "string" ? d.land_category : "";
      land.permitted_use = typeof d.permitted_use === "string" ? d.permitted_use : "";
      land.has_gas = Boolean(d.has_gas);
      land.has_water = Boolean(d.has_water);
      land.has_electricity = Boolean(d.has_electricity);
    }
  } else {
    const d = row.commercial_details as Record<string, unknown> | null | undefined;
    if (d && typeof d === "object") {
      comm.commercial_type = typeof d.commercial_type === "string" ? d.commercial_type : "";
      comm.area_total = d.area_total != null ? String(d.area_total) : "";
      comm.floor = d.floor != null ? String(d.floor) : "";
      comm.floors_total = d.floors_total != null ? String(d.floors_total) : "";
      comm.entrance_type = typeof d.entrance_type === "string" ? d.entrance_type : "";
      comm.parking_spaces = d.parking_spaces != null ? String(d.parking_spaces) : "";
    }
  }

  return { apt, house, land, comm };
}

export function coordsPayload(
  latStr: string,
  lngStr: string,
): {
  public_latitude: string | null;
  public_longitude: string | null;
  real_latitude: string | null;
  real_longitude: string | null;
} {
  const la = decimalOrNull(latStr);
  const lo = decimalOrNull(lngStr);
  if (la == null || lo == null) {
    return {
      public_latitude: null,
      public_longitude: null,
      real_latitude: null,
      real_longitude: null,
    };
  }
  return {
    public_latitude: la,
    public_longitude: lo,
    real_latitude: la,
    real_longitude: lo,
  };
}
