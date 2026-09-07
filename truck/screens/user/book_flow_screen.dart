import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/naql_api.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common_widgets.dart';
import '../../models/models.dart';

class BookFlowScreen extends StatefulWidget {
  final VoidCallback onDone;
  const BookFlowScreen({super.key, required this.onDone});

  @override
  State<BookFlowScreen> createState() => _BookFlowScreenState();
}

class _BookFlowScreenState extends State<BookFlowScreen> {
  final _api = NaqlApi();
  final _pickupController = TextEditingController();
  final _dropoffController = TextEditingController();
  final _minController = TextEditingController();
  final _maxController = TextEditingController();

  BookingStep _step = BookingStep.vehicle;
  VehicleTypeData? _selectedVehicle;
  LatLng? _pickupPoint;
  LatLng? _dropoffPoint;
  bool _scheduleNow = true;
  DateTime? _scheduledTime;
  PaymentMethod _paymentMethod = PaymentMethod.cash;
  bool _submitting = false;
  Future<List<VehicleTypeData>>? _vehiclesFuture;

  @override
  void initState() {
    super.initState();
    _vehiclesFuture = _api.vehicleTypes();
  }

  @override
  void dispose() {
    _pickupController.dispose();
    _dropoffController.dispose();
    _minController.dispose();
    _maxController.dispose();
    super.dispose();
  }

  void _nextStep() {
    if (_step == BookingStep.confirm) {
      _submit();
      return;
    }
    setState(() {
      _step = BookingStep.values[_step.index + 1];
    });
  }

  void _prevStep() {
    if (_step == BookingStep.vehicle) return;
    setState(() {
      _step = BookingStep.values[_step.index - 1];
    });
  }

  bool get _canProceed {
    switch (_step) {
      case BookingStep.vehicle:
        return _selectedVehicle != null;
      case BookingStep.locations:
        return _pickupController.text.trim().isNotEmpty && _dropoffController.text.trim().isNotEmpty;
      case BookingStep.schedule:
        return true;
      case BookingStep.budget:
        final min = double.tryParse(_minController.text);
        final max = double.tryParse(_maxController.text);
        return min != null && max != null && min <= max;
      case BookingStep.payment:
        return true;
      case BookingStep.confirm:
        return true;
    }
  }

  Future<void> _submit() async {
    final token = context.read<AuthProvider>().token;
    final min = double.tryParse(_minController.text);
    final max = double.tryParse(_maxController.text);

    if (token == null ||
        _selectedVehicle == null ||
        _pickupController.text.trim().isEmpty ||
        _dropoffController.text.trim().isEmpty ||
        min == null ||
        max == null ||
        min > max) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please complete all required fields.')),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      await _api.createJob(
        token,
        truckId: _selectedVehicle!.id,
        pickup: _pickupController.text.trim(),
        dropoff: _dropoffController.text.trim(),
        pickupLat: 0.0,
        pickupLng: 0.0,
        dropoffLat: 0.0,
        dropoffLng: 0.0,
        min: min,
        max: max,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Request submitted for provider review.')),
        );
        widget.onDone();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _pickLocation(bool pickup) async {
    final result = await showDialog<LatLng>(
      context: context,
      builder: (_) => const _MapPicker(),
    );
    if (result != null) {
      setState(() {
        if (pickup) {
          _pickupPoint = result;
          _pickupController.text = '${result.latitude.toStringAsFixed(5)}, ${result.longitude.toStringAsFixed(5)}';
        } else {
          _dropoffPoint = result;
          _dropoffController.text = '${result.latitude.toStringAsFixed(5)}, ${result.longitude.toStringAsFixed(5)}';
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    if (user != null && !user.isVerified) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'Verify your email or phone before submitting a truck request.',
            textAlign: TextAlign.center,
            style: interStyle(size: 16, color: kUserMuted),
          ),
        ),
      );
    }

    return FutureBuilder<List<VehicleTypeData>>(
      future: _vehiclesFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return Center(
            child: PrimaryButton(
              label: 'Retry',
              onPressed: () => setState(() => _vehiclesFuture = _api.vehicleTypes()),
            ),
          );
        }

        final vehicles = snapshot.data ?? [];
        if (vehicles.isEmpty) {
          return Center(
            child: Text('No vehicles are available right now.', style: interStyle(size: 16, color: kUserMuted)),
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildProgressBar(),
            const SizedBox(height: 20),
            Expanded(child: _buildStepContent(vehicles)),
            _buildNavigationButtons(),
          ],
        );
      },
    );
  }

  Widget _buildProgressBar() {
    return Row(
      children: List.generate(BookingStep.values.length, (i) {
        final step = BookingStep.values[i];
        final done = _step.index > i;
        final current = _step == step;
        return Expanded(
          child: Row(
            children: [
              Expanded(child: StepDot(done: done, current: current)),
              if (i < BookingStep.values.length - 1)
                Expanded(
                  child: Container(
                    height: 2,
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    color: done ? kGreen : kUserBorder,
                  ),
                ),
            ],
          ),
        );
      }),
    );
  }

  Widget _buildStepContent(List<VehicleTypeData> vehicles) {
    switch (_step) {
      case BookingStep.vehicle:
        return _buildVehicleStep(vehicles);
      case BookingStep.locations:
        return _buildLocationsStep();
      case BookingStep.schedule:
        return _buildScheduleStep();
      case BookingStep.budget:
        return _buildBudgetStep();
      case BookingStep.payment:
        return _buildPaymentStep();
      case BookingStep.confirm:
        return _buildConfirmStep();
    }
  }

  Widget _buildVehicleStep(List<VehicleTypeData> vehicles) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Choose a vehicle', style: outfitStyle(size: 20, weight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text('Select the right size for your shipment.', style: interStyle(size: 14, color: kUserMuted)),
        const SizedBox(height: 16),
        ...vehicles.map((option) {
          final isSelected = _selectedVehicle?.id == option.id;
          return GestureDetector(
            onTap: () => setState(() => _selectedVehicle = option),
            child: Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isSelected ? kGreen : kUserBorder,
                  width: isSelected ? 2 : 1,
                ),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 6, offset: const Offset(0, 2)),
                ],
              ),
              child: Row(
                children: [
                  Text(option.emoji, style: const TextStyle(fontSize: 28)),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(option.label, style: outfitStyle(size: 16, weight: FontWeight.w600)),
                        Text(option.description, style: interStyle(size: 13, color: kUserMuted)),
                        Text('${option.capacity} · ${option.priceRange} EGP', style: interStyle(size: 12, color: kUserTextSub)),
                      ],
                    ),
                  ),
                  if (isSelected) Icon(Icons.check_circle, color: kGreen, size: 24),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildLocationsStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Pickup & drop-off', style: outfitStyle(size: 20, weight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text('Enter addresses.', style: interStyle(size: 14, color: kUserMuted)),
        const SizedBox(height: 16),
        Column(
          children: [
            TextField(
              controller: _pickupController,
              decoration: const InputDecoration(
                labelText: 'Pickup address',
                hintText: 'Enter pickup address',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _dropoffController,
              decoration: const InputDecoration(
                labelText: 'Drop-off address',
                hintText: 'Enter drop-off address',
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildScheduleStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('When do you need it?', style: outfitStyle(size: 20, weight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text('Choose instant dispatch or schedule ahead.', style: interStyle(size: 14, color: kUserMuted)),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: _ScheduleOption(
                emoji: '⚡',
                label: 'Book Now',
                sub: 'Instant dispatch',
                selected: _scheduleNow,
                onTap: () => setState(() => _scheduleNow = true),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _ScheduleOption(
                emoji: '📅',
                label: 'Schedule',
                sub: 'Pick a date & time',
                selected: !_scheduleNow,
                onTap: () => setState(() => _scheduleNow = false),
              ),
            ),
          ],
        ),
        if (!_scheduleNow) ...[
          const SizedBox(height: 20),
          InkWell(
            onTap: () async {
              final now = DateTime.now();
              final date = await showDatePicker(
                context: context,
                firstDate: now,
                lastDate: now.add(const Duration(days: 30)),
                initialDate: now.add(const Duration(days: 1)),
              );
              if (date != null && mounted) {
                final time = await showTimePicker(
                  context: context,
                  initialTime: TimeOfDay.now(),
                );
                if (time != null) {
                  setState(() {
                    _scheduledTime = DateTime(
                      date.year,
                      date.month,
                      date.day,
                      time.hour,
                      time.minute,
                    );
                  });
                }
              }
            },
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: kUserBorder),
              ),
              child: Row(
                children: [
                  const Icon(Icons.calendar_today_outlined, color: kGreen),
                  const SizedBox(width: 12),
                  Text(
                    _scheduledTime == null
                        ? 'Select date and time'
                        : '${_scheduledTime!.day}/${_scheduledTime!.month}/${_scheduledTime!.year} at ${_scheduledTime!.hour}:${_scheduledTime!.minute.toString().padLeft(2, '0')}',
                    style: interStyle(size: 14, color: _scheduledTime == null ? kUserMuted : kUserText),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildBudgetStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Set your budget', style: outfitStyle(size: 20, weight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text('What is the maximum you are willing to pay?', style: interStyle(size: 14, color: kUserMuted)),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(child: _budgetField(_minController, 'Min EGP')),
            const SizedBox(width: 10),
            Expanded(child: _budgetField(_maxController, 'Max EGP')),
          ],
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: ['200', '500', '1,000', '1,500', '2,000'].map((val) {
            final isSelected = _maxController.text == val;
            return GestureDetector(
              onTap: () => setState(() => _maxController.text = val),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? kGreenLight : kUserSubtle,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: isSelected ? kGreen : kUserBorder),
                ),
                child: Text(
                  '$val EGP',
                  style: interStyle(size: 13, color: isSelected ? kGreen : kUserText),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _budgetField(TextEditingController controller, String label) {
    return TextField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      decoration: InputDecoration(labelText: label),
    );
  }

  Widget _buildPaymentStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Payment method', style: outfitStyle(size: 20, weight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text('Choose how you would like to pay.', style: interStyle(size: 14, color: kUserMuted)),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: _PaymentOption(
                emoji: '💵',
                label: 'Cash',
                selected: _paymentMethod == PaymentMethod.cash,
                onTap: () => setState(() => _paymentMethod = PaymentMethod.cash),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _PaymentOption(
                emoji: '💳',
                label: 'Visa',
                selected: _paymentMethod == PaymentMethod.visa,
                onTap: () => setState(() => _paymentMethod = PaymentMethod.visa),
              ),
            ),
          ],
        ),
        if (_paymentMethod == PaymentMethod.visa) ...[
          const SizedBox(height: 16),
          const TextField(
            decoration: InputDecoration(
              labelText: 'Card number',
              hintText: '4242 4242 4242 4242',
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  decoration: const InputDecoration(labelText: 'Expiry'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  decoration: const InputDecoration(labelText: 'CVV'),
                ),
              ),
            ],
          ),
        ],
        const SizedBox(height: 12),
        Text(
          'Payment is not available yet. Approved requests remain pending payment.',
          style: interStyle(size: 12, color: kUserMuted),
        ),
      ],
    );
  }

  Widget _buildConfirmStep() {
    final carLabel = _selectedVehicle?.label ?? 'Unknown';
    final pickup = _pickupController.text;
    final dropoff = _dropoffController.text;
    final min = _minController.text;
    final max = _maxController.text;
    final paymentLabel = _paymentMethod == PaymentMethod.cash ? 'Cash' : 'Visa';
    final scheduleLabel = _scheduleNow ? 'Now' : (_scheduledTime != null ? '${_scheduledTime!.day}/${_scheduledTime!.month} ${_scheduledTime!.hour}:${_scheduledTime!.minute}' : 'Unknown');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Confirm your request', style: outfitStyle(size: 20, weight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text('Review everything before submitting.', style: interStyle(size: 14, color: kUserMuted)),
        const SizedBox(height: 16),
        SectionCard(
          child: Column(
            children: [
              _confirmRow('Vehicle', carLabel),
              _confirmRow('Pickup', pickup),
              _confirmRow('Drop-off', dropoff),
              _confirmRow('Schedule', scheduleLabel),
              _confirmRow('Budget', '$min–$max EGP'),
              _confirmRow('Payment', paymentLabel),
            ],
          ),
        ),
      ],
    );
  }

  Widget _confirmRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            child: Text(label, style: interStyle(size: 13, color: kUserMuted)),
          ),
          Expanded(
            child: Text(value, style: interStyle(size: 14, weight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }

  Widget _buildNavigationButtons() {
    final isLast = _step == BookingStep.confirm;
    final isFirst = _step == BookingStep.vehicle;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      child: Row(
        children: [
          if (!isFirst)
            Expanded(
              child: OutlinedButton(
                onPressed: _prevStep,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                ),
                child: Text('Back', style: outfitStyle(size: 15, weight: FontWeight.w600)),
              ),
            ),
          if (!isFirst) const SizedBox(width: 10),
          Expanded(
            child: ElevatedButton(
              onPressed: _canProceed && !_submitting ? _nextStep : null,
              child: _submitting
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(isLast ? 'Submit request' : 'Continue', style: outfitStyle(size: 15, weight: FontWeight.w700, color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }
}

class _ScheduleOption extends StatelessWidget {
  final String emoji;
  final String label;
  final String sub;
  final bool selected;
  final VoidCallback onTap;

  const _ScheduleOption({
    required this.emoji,
    required this.label,
    required this.sub,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected ? kGreenLight : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: selected ? kGreen : kUserBorder, width: selected ? 2 : 1),
        ),
        child: Column(
          children: [
            Text(emoji, style: const TextStyle(fontSize: 24)),
            const SizedBox(height: 6),
            Text(label, style: outfitStyle(size: 14, weight: FontWeight.w600)),
            Text(sub, style: interStyle(size: 12, color: kUserMuted)),
          ],
        ),
      ),
    );
  }
}

class _PaymentOption extends StatelessWidget {
  final String emoji;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _PaymentOption({
    required this.emoji,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected ? kGreenLight : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: selected ? kGreen : kUserBorder, width: selected ? 2 : 1),
        ),
        child: Column(
          children: [
            Text(emoji, style: const TextStyle(fontSize: 24)),
            const SizedBox(height: 6),
            Text(label, style: outfitStyle(size: 14, weight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}

class _MapPicker extends StatefulWidget {
  const _MapPicker();

  @override
  State<_MapPicker> createState() => _MapPickerState();
}

class _MapPickerState extends State<_MapPicker> {
  static const _cairo = LatLng(30.0444, 31.2357);
  LatLng? _point;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Select a location'),
      content: SizedBox(
        width: 600,
        height: 420,
        child: FlutterMap(
          options: MapOptions(
            initialCenter: _cairo,
            initialZoom: 11,
            onTap: (tapPosition, point) => setState(() => _point = point),
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.naql.app',
            ),
            if (_point != null)
              MarkerLayer(
                markers: [
                  Marker(
                    point: _point!,
                    width: 40,
                    height: 40,
                    child: const Icon(Icons.location_on, color: Colors.red, size: 40),
                  ),
                ],
              ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: _point == null ? null : () => Navigator.pop(context, _point),
          child: const Text('Use location'),
        ),
      ],
    );
  }
}