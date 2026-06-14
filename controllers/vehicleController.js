import Vehicle from "../models/vehicleModel.js";

// إضافة سيارة جديدة
export const addVehicle = async (req, res) => {
  try {
    const { brand, model, year, fuelType, condition } = req.body;
    const vehicle = await Vehicle.create({
      user: req.user._id,
      brand,
      model,
      year,
      fuelType,
      condition,
    });
    res.status(201).json(vehicle);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// جلب جميع سيارات المستخدم
export const getMyVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ user: req.user._id });
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// حذف سيارة
export const deleteVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ message: "السيارة غير موجودة" });

    if (vehicle.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "غير مصرح بالحذف" });
    }

    await vehicle.deleteOne();
    res.json({ message: "تم حذف السيارة بنجاح" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
