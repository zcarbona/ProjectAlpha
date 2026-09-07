import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class StarRating extends StatelessWidget {
  final double rating;
  final bool dark;
  const StarRating({super.key, required this.rating, this.dark = false});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) {
        return Text(
          i < rating.floor() ? '★' : '☆',
          style: TextStyle(
            color: kAmber,
            fontSize: 11,
            fontFamily: 'serif',
          ),
        );
      }),
    );
  }
}

class AvatarCircle extends StatelessWidget {
  final String initials;
  final double size;
  final bool dark;
  final Color? bg;
  final Color? fg;

  const AvatarCircle({
    super.key,
    required this.initials,
    this.size = 40,
    this.dark = false,
    this.bg,
    this.fg,
  });

  @override
  Widget build(BuildContext context) {
    final background = bg ?? (dark ? kAdminSecondary : kGreenLight);
    final foreground = fg ?? (dark ? kTeal : kGreen);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: background,
        shape: BoxShape.circle,
        border: Border.all(
          color: dark ? kTeal.withOpacity(0.3) : kGreenBorder,
          width: 1.5,
        ),
      ),
      child: Center(
        child: Text(
          initials,
          style: outfitStyle(
            size: size * 0.32,
            weight: FontWeight.w700,
            color: foreground,
          ),
        ),
      ),
    );
  }
}

class SectionCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final bool dark;

  const SectionCard({
    super.key,
    required this.child,
    this.padding,
    this.dark = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: dark ? kAdminSurface : kUserSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: dark ? kAdminBorder : kUserBorder,
        ),
        boxShadow: dark
            ? []
            : [
                BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                )
              ],
      ),
      child: child,
    );
  }
}

class StatusBadge extends StatelessWidget {
  final String label;
  final Color bg;
  final Color fg;

  const StatusBadge({
    super.key,
    required this.label,
    required this.bg,
    required this.fg,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: monoStyle(size: 9, color: fg),
      ),
    );
  }
}

class PrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;

  const PrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: kGreen,
          foregroundColor: Colors.white,
          disabledBackgroundColor: kGreen.withOpacity(0.4),
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          elevation: 0,
          shadowColor: kGreen.withOpacity(0.3),
        ),
        child: Text(
          label,
          style: outfitStyle(
            size: 15,
            weight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

class StepDot extends StatelessWidget {
  final bool done;
  final bool current;

  const StepDot({super.key, this.done = false, this.current = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 20,
      height: 20,
      decoration: BoxDecoration(
        color: done
            ? kGreen
            : current
                ? kAmberLight
                : Colors.transparent,
        shape: BoxShape.circle,
        border: Border.all(
          color: done
              ? kGreen
              : current
                  ? kAmber
                  : const Color(0xFFE5E7EB),
          width: 2,
        ),
      ),
      child: Center(
        child: done
            ? const Icon(Icons.check, size: 12, color: Colors.white)
            : current
                ? Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      color: kAmber,
                      shape: BoxShape.circle,
                    ),
                  )
                : null,
      ),
    );
  }
}

class RouteDots extends StatelessWidget {
  final bool dark;
  const RouteDots({super.key, this.dark = false});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: kGreen,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(color: kGreen.withOpacity(0.3), blurRadius: 4)
            ],
          ),
        ),
        Container(
          width: 1,
          height: 28,
          color: dark ? kAdminSecondary : const Color(0xFFE5E7EB),
        ),
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: kAmber,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(color: kAmber.withOpacity(0.3), blurRadius: 4)
            ],
          ),
        ),
      ],
    );
  }
}

class MiniMapPainter extends CustomPainter {
  final bool light;
  const MiniMapPainter({this.light = true});

  @override
  void paint(Canvas canvas, Size size) {
    final gridPaint = Paint()
      ..color = light ? const Color(0xFFC8E6DF) : const Color(0xFF1A2238)
      ..strokeWidth = 0.5;

    for (final pct in [0.15, 0.30, 0.45, 0.60, 0.75, 0.90]) {
      canvas.drawLine(
          Offset(size.width * pct, 0), Offset(size.width * pct, size.height), gridPaint);
      canvas.drawLine(
          Offset(0, size.height * pct), Offset(size.width, size.height * pct), gridPaint);
    }

    final roadPaint = Paint()
      ..color = light ? const Color(0xFFA8D8CE) : const Color(0xFF1E2840)
      ..strokeWidth = 5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final path1 = Path()
      ..moveTo(0, size.height * 0.55)
      ..quadraticBezierTo(size.width * 0.3, size.height * 0.50, size.width * 0.5, size.height * 0.52)
      ..quadraticBezierTo(size.width * 0.7, size.height * 0.54, size.width, size.height * 0.50);
    canvas.drawPath(path1, roadPaint);

    final path2 = Path()
      ..moveTo(size.width * 0.45, 0)
      ..quadraticBezierTo(size.width * 0.48, size.height * 0.35, size.width * 0.5, size.height * 0.52)
      ..quadraticBezierTo(size.width * 0.52, size.height * 0.65, size.width * 0.55, size.height);
    canvas.drawPath(path2, roadPaint..strokeWidth = 4);

    final routePaint = Paint()
      ..color = kGreen
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    final routePath = Path()
      ..moveTo(size.width * 0.25, size.height * 0.62)
      ..quadraticBezierTo(size.width * 0.44, size.height * 0.56, size.width * 0.52, size.height * 0.52)
      ..quadraticBezierTo(size.width * 0.64, size.height * 0.47, size.width * 0.75, size.height * 0.35);

    final dashPath = _dashPath(routePath, 6, 4);
    canvas.drawPath(dashPath, routePaint);

    _drawPulse(canvas, Offset(size.width * 0.25, size.height * 0.62), kGreen);
    _drawPulse(canvas, Offset(size.width * 0.75, size.height * 0.35), kAmber);
  }

  void _drawPulse(Canvas canvas, Offset center, Color color) {
    canvas.drawCircle(center, 7, Paint()..color = color.withOpacity(0.15));
    canvas.drawCircle(center, 4, Paint()..color = color);
  }

  Path _dashPath(Path source, double dashLen, double gapLen) {
    final metrics = source.computeMetrics();
    final result = Path();
    for (final metric in metrics) {
      double dist = 0;
      while (dist < metric.length) {
        final end = (dist + dashLen).clamp(0.0, metric.length);
        result.addPath(metric.extractPath(dist, end), Offset.zero);
        dist += dashLen + gapLen;
      }
    }
    return result;
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}